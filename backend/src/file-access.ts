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
