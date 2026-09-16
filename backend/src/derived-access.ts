import type { Queryable } from './db.js';
import { admitDerivedRows, projectReadableFields, type Caller } from './authorization.js';

const DERIVED_ROWS_FIELDS: Record<string, DerivedRowsField[] | undefined> = {
  GameType: [
    { key: 'leaderboard', element: 'LeaderboardEntry', rows: { resource: 'leaderboards' } },
  ],
};

interface DerivedRowsField {
  key: string;
  element: string;
  rows: { resource: string } | { field: string };
}

export async function readableDerivedRows(
  client: Queryable,
  typeName: string,
  row: Record<string, unknown>,
  caller: Caller,
  hostPath: string,
  visited: ReadonlySet<string>
): Promise<Record<string, unknown>> {
  const readable: Record<string, unknown> = { ...row };
  const fields = DERIVED_ROWS_FIELDS[typeName];
  if (fields === undefined) {
    return readable;
  }
  const within = new Set([...visited, typeName]);
  for (const entry of fields) {
    if (visited.has(typeName)) {
      delete readable[entry.key];
    } else if (entry.key in row) {
      const path =
        'resource' in entry.rows ? entry.rows.resource : `${hostPath}.${entry.rows.field}`;
      const rows: Array<Record<string, unknown>> = [];
      for (const admitted of await admitDerivedRows(client, path, row[entry.key], caller)) {
        const nested = await readableDerivedRows(
          client,
          entry.element,
          admitted.row,
          caller,
          path,
          within
        );
        rows.push(projectReadableFields(nested, admitted.columns));
      }
      readable[entry.key] = rows;
    }
  }
  return readable;
}
