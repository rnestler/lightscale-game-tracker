import { pool } from './db.js';

export interface ReferenceSpec {
  field: string;
  table: string;
}

export interface StoredListSpec {
  field: string;
  table: string;
  owner: string;
  element: string;
}

type Row = Record<string, unknown>;

async function listedIds(list: StoredListSpec, ownerIds: string[]): Promise<Map<string, string[]>> {
  const { rows } = await pool.query<{ ownerId: string; elementId: string }>(
    `SELECT "${list.owner}" AS "ownerId", "${list.element}" AS "elementId" FROM "${list.table}" WHERE "${list.owner}" = ANY($1) ORDER BY "_position"`,
    [ownerIds]
  );
  const byOwner = new Map<string, string[]>();
  for (const row of rows) {
    byOwner.set(row.ownerId, [...(byOwner.get(row.ownerId) ?? []), row.elementId]);
  }
  return byOwner;
}

export async function attachListIds(rows: Row[], lists: StoredListSpec[]): Promise<Row[]> {
  if (rows.length === 0) {
    return rows;
  }
  const ownerIds = rows.map((row) => String(row.id));
  const attached = rows.map((row) => ({ ...row }));
  for (const list of lists) {
    const byOwner = await listedIds(list, ownerIds);
    for (const row of attached) {
      row[list.field] = byOwner.get(String(row.id)) ?? [];
    }
  }
  return attached;
}

export async function attachRowListIds(row: Row, lists: StoredListSpec[]): Promise<Row> {
  const [attached] = await attachListIds([row], lists);
  return attached;
}
