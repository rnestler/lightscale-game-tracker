import { pool } from './db.js';

export interface ReferenceSpec {
  field: string;
  table: string;
}

export async function ensureReferences(
  tableName: string,
  body: Record<string, unknown>,
  references: ReferenceSpec[]
): Promise<string | null> {
  for (const reference of references) {
    const id = body[reference.field];
    if (typeof id === 'string' && id.length > 0) {
      const { rows } = await pool.query(`SELECT 1 FROM "${reference.table}" WHERE "id" = $1`, [id]);
      if (rows.length === 0) {
        return `Reference '${reference.field}' on '${tableName}' points to a non-existent '${reference.table}' record`;
      }
    }
  }
  return null;
}

export async function ensureListReferences(
  tableName: string,
  entries: Array<Record<string, unknown>>,
  references: ReferenceSpec[]
): Promise<string | null> {
  for (const reference of references) {
    const ids = [
      ...new Set(
        entries
          .map((entry) => entry[reference.field])
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      ),
    ];
    if (ids.length > 0) {
      const { rows } = await pool.query<{ id: string }>(
        `SELECT id FROM "${reference.table}" WHERE id = ANY($1)`,
        [ids]
      );
      const found = new Set(rows.map((row) => row.id));
      if (ids.some((id) => !found.has(id))) {
        return `Reference '${reference.field}' on '${tableName}' points to a non-existent '${reference.table}' record`;
      }
    }
  }
  return null;
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
