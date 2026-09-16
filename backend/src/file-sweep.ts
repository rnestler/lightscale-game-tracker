import type { PoolClient } from 'pg';
import { pool } from './db.js';
import { withTransaction } from './transaction.js';
import { recordRuntimeError } from './utils/diagnostics.js';

const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const FILES_TABLE = '$FILES';
const BACKUP_COLUMN_PREFIX = '$OLD_';
const TOKEN_SEPARATOR = '[^A-Za-z0-9_-]+';
const SWEEPABLE_ID = '^[A-Za-z0-9_-]+$';

interface StoredColumn {
  tableName: string;
  columnName: string;
}

const FILE_COLUMNS: StoredColumn[] = [
  {
    tableName: 'Player',
    columnName: 'avatar',
  },
];

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function backupColumns(client: PoolClient): Promise<StoredColumn[]> {
  const { rows } = await client.query<StoredColumn>(
    `SELECT c.table_name AS "tableName", c.column_name AS "columnName"
     FROM information_schema.columns c
     INNER JOIN information_schema.tables t
       ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = current_schema()
       AND t.table_type = 'BASE TABLE'
       AND starts_with(c.column_name, $1)
     ORDER BY c.table_name, c.column_name`,
    [BACKUP_COLUMN_PREFIX]
  );
  return rows;
}

function referencedTokensQuery(columns: StoredColumn[]): string {
  return columns
    .map(
      (column) =>
        `SELECT regexp_split_to_table(${quoteIdentifier(column.columnName)}::text, $1) AS token FROM ${quoteIdentifier(column.tableName)}`
    )
    .join(' UNION ALL ');
}

export async function sweepUnreferencedFiles(client: PoolClient): Promise<number> {
  const columns = [...FILE_COLUMNS, ...(await backupColumns(client))];
  if (columns.length === 0) {
    throw new Error('The schema declares no column that could reference an upload');
  }
  const deleted = await client.query(
    `DELETE FROM ${quoteIdentifier(FILES_TABLE)} file WHERE file.id ~ $2 AND NOT EXISTS (SELECT 1 FROM (${referencedTokensQuery(columns)}) referenced WHERE referenced.token = file.id)`,
    [TOKEN_SEPARATOR, SWEEPABLE_ID]
  );
  return deleted.rowCount ?? 0;
}

function runSweep(): void {
  withTransaction(pool, sweepUnreferencedFiles).catch((error: unknown) => {
    recordRuntimeError('files.sweep', error);
  });
}

export function startFileSweep(): void {
  runSweep();
  const timer = setInterval(runSweep, SWEEP_INTERVAL_MS);
  timer.unref();
}
