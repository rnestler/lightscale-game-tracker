import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

export interface EmbeddedFieldSpec {
  key: string;
  table: string;
  columns: string[];
  temporalColumns: string[];
  embedded: EmbeddedFieldSpec[];
}

function storedColumnValue(spec: EmbeddedFieldSpec, name: string, value: unknown): unknown {
  if (spec.temporalColumns.includes(name)) {
    return value === undefined || value === '' ? null : value;
  }
  return value ?? '';
}

async function upsertEmbeddedRow(
  client: PoolClient,
  spec: EmbeddedFieldSpec,
  values: Record<string, unknown>,
  existingId: string | null
): Promise<string> {
  const columnList = spec.columns.map((name) => `"${name}"`).join(', ');
  let existingRow: Record<string, unknown> | null = null;
  let resolvedId: string | null = null;
  if (existingId !== null && existingId !== '') {
    const found = await client.query<Record<string, unknown>>(
      `SELECT id, ${columnList} FROM "${spec.table}" WHERE id = $1`,
      [existingId]
    );
    if (found.rows.length > 0) {
      existingRow = found.rows[0];
      resolvedId = existingId;
    }
  }
  const target = values;
  for (const childSpec of spec.embedded) {
    const raw = target[childSpec.key];
    const childValues =
      raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const childExistingId =
      existingRow !== null && typeof existingRow[childSpec.key] === 'string'
        ? (existingRow[childSpec.key] as string)
        : null;
    target[childSpec.key] = await upsertEmbeddedRow(
      client,
      childSpec,
      childValues,
      childExistingId
    );
  }
  const columnValues = spec.columns.map((name) => storedColumnValue(spec, name, values[name]));
  if (resolvedId !== null) {
    const setClause = spec.columns.map((name, index) => `"${name}" = $${index + 2}`).join(', ');
    await client.query(`UPDATE "${spec.table}" SET ${setClause} WHERE id = $1`, [
      resolvedId,
      ...columnValues,
    ]);
    return resolvedId;
  }
  const id = randomUUID();
  const placeholders = spec.columns.map((_, index) => `$${index + 2}`).join(', ');
  await client.query(
    `INSERT INTO "${spec.table}" (id, ${columnList}) VALUES ($1, ${placeholders})`,
    [id, ...columnValues]
  );
  return id;
}

export async function processEmbedded(
  client: PoolClient,
  body: Record<string, unknown>,
  specs: EmbeddedFieldSpec[],
  existingParentRow: Record<string, unknown> | null
): Promise<void> {
  const target = body;
  for (const spec of specs.filter((candidate) => target[candidate.key] !== undefined)) {
    const raw = target[spec.key];
    const values = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const existingId =
      existingParentRow !== null && typeof existingParentRow[spec.key] === 'string'
        ? (existingParentRow[spec.key] as string)
        : null;
    target[spec.key] = await upsertEmbeddedRow(client, spec, values, existingId);
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
      enrichedChildren = await enrichEmbeddedRows(pool, found.rows, spec.embedded);
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
