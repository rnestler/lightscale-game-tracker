import { pool } from './db.js';
import { admissionClause, hasGrant, whereClause, type Caller } from './authorization.js';
import type { ReferenceSpec } from './references.js';

interface ReferenceHolder {
  path: string | null;
  exclusion: string | null;
}

const REFERENCE_HOLDERS: Record<string, ReferenceHolder | undefined> = {
  user: { path: null, exclusion: null },
  GameType: { path: 'games', exclusion: null },
  Player: { path: 'players', exclusion: null },
  LeaderboardEntry: { path: 'leaderboards', exclusion: null },
  Match: { path: 'matches', exclusion: null },
};

type StoredRow = Record<string, unknown>;

export function nothingStored(): Promise<StoredRow | null> {
  return Promise.resolve(null);
}

export async function storedColumns(
  table: string,
  id: string,
  fields: string[]
): Promise<StoredRow | null> {
  const columns = fields.map((field) => `"${field}"`).join(', ');
  const { rows } = await pool.query<StoredRow>(`SELECT ${columns} FROM "${table}" WHERE id = $1`, [
    id,
  ]);
  return rows.at(0) ?? null;
}

function referenceIds(value: unknown): string[] {
  const items: unknown[] = Array.isArray(value) ? value : [value];
  return items.filter((item): item is string => typeof item === 'string' && item !== '');
}

async function readableIds(table: string, ids: string[], caller: Caller): Promise<Set<string>> {
  const holder = REFERENCE_HOLDERS[table];
  if (holder === undefined) {
    throw new Error(`No collection holds the referenced records of '${table}'`);
  }
  if (ids.length === 0 || (holder.path !== null && !hasGrant(holder.path, 'read', caller.roles))) {
    return new Set();
  }
  const values: unknown[] = [ids];
  const admission =
    holder.path === null ? null : admissionClause(holder.path, 'read', caller, 'f', values);
  const { rows } = await pool.query<{ id: string }>(
    `SELECT f.id FROM "${table}" f${whereClause(['f.id = ANY($1)', holder.exclusion, admission])}`,
    values
  );
  return new Set(rows.map((row) => row.id));
}

export async function unreadableReference(
  entries: Array<Record<string, unknown>>,
  references: ReferenceSpec[],
  caller: Caller,
  loadKept: () => Promise<Record<string, unknown> | null>
): Promise<string | null> {
  for (const reference of references) {
    const ids = [...new Set(entries.flatMap((entry) => referenceIds(entry[reference.field])))];
    const kept = ids.length === 0 ? [] : referenceIds((await loadKept())?.[reference.field]);
    const checked = ids.filter((id) => !kept.includes(id));
    const readable = await readableIds(reference.table, checked, caller);
    if (checked.some((id) => !readable.has(id))) {
      return reference.field;
    }
  }
  return null;
}
