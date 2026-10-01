import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { UploadRefusedError } from './file-inspection.js';
import { enrichRow, stageFiles, storeStagedFiles } from './files.js';
import type { StagedFile } from './files.js';

export interface EmbeddedFieldSpec {
  key: string;
  table: string;
  columns: string[];
  temporalColumns: string[];
  fileFields: string[];
  embedded: EmbeddedFieldSpec[];
}

type Row = Record<string, unknown>;

export interface RecordWrites {
  insert(client: PoolClient, type: string, row: Row): Promise<void>;
  update(client: PoolClient, type: string, id: string, change: Row): Promise<void>;
  unreadableFile(
    body: Row,
    fileFields: string[],
    loadKept: () => Promise<Row | null>
  ): Promise<boolean>;
}

function storedColumnValue(spec: EmbeddedFieldSpec, name: string, value: unknown): unknown {
  if (spec.temporalColumns.includes(name)) {
    return value === undefined || value === '' ? null : value;
  }
  return value ?? '';
}

function isRecordValue(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function storedId(row: Row | null, key: string): string | null {
  const id = row?.[key];
  return typeof id === 'string' && id !== '' ? id : null;
}

async function storedEmbeddedRow(
  client: PoolClient,
  spec: EmbeddedFieldSpec,
  existingId: string | null
): Promise<Row | null> {
  if (existingId === null) {
    return null;
  }
  const columnList = spec.columns.map((name) => `"${name}"`).join(', ');
  const found = await client.query<Row>(
    `SELECT id, ${columnList} FROM "${spec.table}" WHERE id = $1`,
    [existingId]
  );
  return found.rows.at(0) ?? null;
}

async function storeAttachedFiles(
  client: PoolClient,
  spec: EmbeddedFieldSpec,
  values: Row,
  existingRow: Row | null,
  writes: RecordWrites
): Promise<void> {
  if (spec.fileFields.length === 0) {
    return;
  }
  if (await writes.unreadableFile(values, spec.fileFields, () => Promise.resolve(existingRow))) {
    throw new UploadRefusedError(404, 'FILE_NOT_FOUND', 'File not found');
  }
  const staged: StagedFile[] = [];
  stageFiles(values, spec.fileFields, staged);
  await storeStagedFiles(client, staged);
}

async function upsertEmbeddedRow(
  client: PoolClient,
  spec: EmbeddedFieldSpec,
  values: Row,
  existingId: string | null,
  writes: RecordWrites
): Promise<string> {
  const existingRow = await storedEmbeddedRow(client, spec, existingId);
  const target = values;
  await storeAttachedFiles(client, spec, target, existingRow, writes);
  for (const childSpec of spec.embedded) {
    const child = target[childSpec.key];
    const childId = storedId(existingRow, childSpec.key);
    target[childSpec.key] = isRecordValue(child)
      ? await upsertEmbeddedRow(client, childSpec, child, childId, writes)
      : (childId ?? '');
  }
  const columns: Row = {};
  for (const name of spec.columns) {
    columns[name] = storedColumnValue(spec, name, target[name]);
  }
  if (existingRow !== null) {
    const id = String(existingRow['id']);
    await writes.update(client, spec.table, id, columns);
    return id;
  }
  const id = randomUUID();
  await writes.insert(client, spec.table, { id, ...columns });
  return id;
}

export async function processEmbedded(
  client: PoolClient,
  body: Row,
  specs: EmbeddedFieldSpec[],
  existingParentRow: Row | null,
  writes: RecordWrites
): Promise<void> {
  const target = body;
  for (const spec of specs) {
    const values = target[spec.key];
    if (isRecordValue(values)) {
      const existingId = storedId(existingParentRow, spec.key);
      target[spec.key] = await upsertEmbeddedRow(client, spec, values, existingId, writes);
    }
  }
}

export async function deleteEmbedded(
  client: PoolClient,
  row: Record<string, unknown>,
  specs: EmbeddedFieldSpec[]
): Promise<void> {
  for (const spec of specs) {
    const id = row[spec.key];
    if (typeof id === 'string' && id.length > 0) {
      if (spec.embedded.length > 0) {
        const keyColumns = spec.embedded.map((childSpec) => `"${childSpec.key}"`).join(', ');
        const found = await client.query<Record<string, unknown>>(
          `SELECT ${keyColumns} FROM "${spec.table}" WHERE id = $1`,
          [id]
        );
        if (found.rows.length > 0) {
          await deleteEmbedded(client, found.rows[0], spec.embedded);
        }
      }
      await client.query(`DELETE FROM "${spec.table}" WHERE id = $1`, [id]);
    }
  }
}

async function enrichFileFields(
  rows: Array<Record<string, unknown>>,
  spec: EmbeddedFieldSpec
): Promise<Array<Record<string, unknown>>> {
  if (spec.fileFields.length === 0) {
    return rows;
  }
  const enriched: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    enriched.push(await enrichRow(row, spec.fileFields));
  }
  return enriched;
}

export async function enrichEmbeddedRows(
  pool: Pool,
  rows: Array<Record<string, unknown>>,
  specs: EmbeddedFieldSpec[]
): Promise<Array<Record<string, unknown>>> {
  if (specs.length === 0 || rows.length === 0) {
    return rows;
  }
  const results = rows.map((row) => ({ ...row }));
  for (const spec of specs) {
    const ids = Array.from(
      new Set(
        results
          .map((row) => row[spec.key])
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    );
    let enrichedChildren: Array<Record<string, unknown>> = [];
    if (ids.length > 0) {
      const columnList = spec.columns.map((name) => `"${name}"`).join(', ');
      const found = await pool.query<Record<string, unknown>>(
        `SELECT id, ${columnList} FROM "${spec.table}" WHERE id = ANY($1)`,
        [ids]
      );
      enrichedChildren = await enrichFileFields(
        await enrichEmbeddedRows(pool, found.rows, spec.embedded),
        spec
      );
    }
    const enrichedById = new Map(enrichedChildren.map((child) => [child['id'] as string, child]));
    for (const row of results) {
      const id = row[spec.key];
      row[spec.key] = typeof id === 'string' ? (enrichedById.get(id) ?? null) : null;
    }
  }
  return results;
}

export async function enrichEmbeddedRow(
  pool: Pool,
  row: Record<string, unknown>,
  specs: EmbeddedFieldSpec[]
): Promise<Record<string, unknown>> {
  const enriched = await enrichEmbeddedRows(pool, [row], specs);
  return enriched[0] ?? row;
}
