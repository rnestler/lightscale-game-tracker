import { pool } from './db.js';
import {
  isAdmin,
  admissionClause,
  ownedColumn,
  rowsExposeFile,
  whereClause,
  type Caller,
} from './authorization.js';

export async function canDownloadFile(fileId: string, caller: Caller): Promise<boolean> {
  if (isAdmin(caller.roles)) {
    return true;
  }
  {
    const values: unknown[] = [fileId];
    const owned = ownedColumn('players', 'read', caller, 'f', values);
    const admission = admissionClause('players', 'read', caller, 'f', values);
    const { rows } = await pool.query<Record<string, unknown>>(
      `SELECT f.*, ${owned} FROM "Player" f${whereClause(['(f."avatar" = $1)', admission])}`,
      values
    );
    if (rowsExposeFile('players', caller.roles, rows, ['avatar'], fileId)) {
      return true;
    }
  }
  return false;
}

type StoredRow = Record<string, unknown>;

function attachedFileIds(value: unknown): string[] {
  const items: unknown[] = Array.isArray(value) ? value : [value];
  const ids: string[] = [];
  for (const item of items) {
    if (
      typeof item === 'object' &&
      item !== null &&
      !('data' in item) &&
      'id' in item &&
      typeof item.id === 'string'
    ) {
      ids.push(item.id);
    }
  }
  return ids;
}

function storesFileId(stored: unknown, fileId: string): boolean {
  return Array.isArray(stored) ? stored.includes(fileId) : stored === fileId;
}

export async function unreadableFile(
  body: StoredRow,
  fileFields: string[],
  caller: Caller,
  loadKept: () => Promise<StoredRow | null>
): Promise<boolean> {
  let keptRow: Promise<StoredRow | null> | null = null;
  for (const fieldName of fileFields) {
    for (const fileId of attachedFileIds(body[fieldName])) {
      keptRow ??= loadKept();
      const kept = await keptRow;
      const stored = kept !== null && storesFileId(kept[fieldName], fileId);
      if (!stored && !(await canDownloadFile(fileId, caller))) {
        return true;
      }
    }
  }
  return false;
}
