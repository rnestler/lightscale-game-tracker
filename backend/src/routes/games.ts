import { Router } from 'express';
import type { Request, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { pool } from '../db.js';
import {
  parseQueryRequest,
  readPageRows,
  pageResult,
  queryFieldRestriction,
  buildCountQuery,
} from '../pagination.js';
import {
  getEffectiveUserRoles,
  hasGrant,
  admissionClause,
  ownedColumn,
  whereClause,
  conditions,
  admitRows,
  projectRows,
  projectRow,
  projectReadableFields,
  writtenColumns,
  queryableFieldSet,
  readableFieldSet,
  unwritableField,
  ownedFlag,
  type Caller,
  type GrantOperation,
  type RefusalAnswer,
  type WriteOutcome,
} from '../authorization.js';
import { withTransaction } from '../transaction.js';
import { auth } from '../auth.js';
import { assignedColumns, mergedCandidate } from '../record-writes.js';
import { enforceGameTypeConstraints } from '../constraints.js';
import { collectVisibleRuleViolations } from '../rule-violations.js';
import { deriveGameType, deriveGameTypeRows } from '../derived.js';
import { readableDerivedRows } from '../derived-access.js';

export const gamesRouter = Router();

function getSession(request: Request): ReturnType<typeof auth.api.getSession> {
  return auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
}

interface Body {
  [key: string]: unknown;
  name: string;
  category: string;
  rulesVariant: string;
  defaultRating: number;
  description: string;
}

function isBody(value: unknown): value is Body {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const body = value as Record<string, unknown>;
  if (!(typeof body['name'] === 'string')) {
    return false;
  }
  if (!(
    body['category'] === '' ||
    (typeof body['category'] === 'string' &&
      ['chess', 'billiards', 'tableTennis', 'darts', 'boardGames', 'cardGames', 'custom'].includes(
        body['category']
      ))
  )) {
    return false;
  }
  if (!(typeof body['rulesVariant'] === 'string')) {
    return false;
  }
  if (!(typeof body['defaultRating'] === 'number' && Number.isInteger(body['defaultRating']))) {
    return false;
  }
  if (!(typeof body['description'] === 'string')) {
    return false;
  }
  return true;
}

interface UpdateBody {
  [key: string]: unknown;
  name?: string;
  category?: string;
  rulesVariant?: string;
  defaultRating?: number;
  description?: string;
}

function isUpdateBody(value: unknown): value is UpdateBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const body = value as Record<string, unknown>;
  if (!(body['name'] === undefined || typeof body['name'] === 'string')) {
    return false;
  }
  if (!(
    body['category'] === undefined ||
    (typeof body['category'] === 'string' &&
      ['chess', 'billiards', 'tableTennis', 'darts', 'boardGames', 'cardGames', 'custom'].includes(
        body['category']
      ))
  )) {
    return false;
  }
  if (!(body['rulesVariant'] === undefined || typeof body['rulesVariant'] === 'string')) {
    return false;
  }
  if (!(
    body['defaultRating'] === undefined ||
    (typeof body['defaultRating'] === 'number' && Number.isInteger(body['defaultRating']))
  )) {
    return false;
  }
  if (!(body['description'] === undefined || typeof body['description'] === 'string')) {
    return false;
  }
  return true;
}

async function requireGrant(
  request: Request,
  response: Response,
  path: string,
  operation: GrantOperation
): Promise<Caller | null> {
  const session = await getSession(request);
  const caller: Caller = session
    ? { userId: session.user.id, roles: await getEffectiveUserRoles(pool, session.user.id) }
    : { userId: null, roles: ['guest'] };
  if (hasGrant(path, operation, caller.roles)) {
    return caller;
  }
  if (session) {
    response.status(403).json({ error: 'Forbidden' });
  } else {
    response
      .status(401)
      .json({ error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED' });
  }
  return null;
}

gamesRouter.get('/', async (request, response) => {
  const access = await requireGrant(request, response, 'games', 'read');
  if (access === null) {
    return;
  }
  const values: unknown[] = [];
  const admission = admissionClause('games', 'read', access, 'f', values);
  const { rows } = await pool.query<Record<string, unknown>>(
    `SELECT f.id FROM "GameType" f${whereClause([admission])}`,
    values
  );
  const visibleIds = rows.map((row) => String(row.id));
  response.json(visibleIds);
});

gamesRouter.post('/query', async (request, response) => {
  const access = await requireGrant(request, response, 'games', 'read');
  if (access === null) {
    return;
  }
  const parsed = parseQueryRequest(request.body);
  if (typeof parsed === 'string') {
    response.status(400).json({ error: parsed });
    return;
  }
  const restriction = queryFieldRestriction(parsed, queryableFieldSet('games', access.roles));
  if (restriction !== null) {
    response.status(403).json({ error: restriction });
    return;
  }
  const values: unknown[] = [];
  const admission = admissionClause('games', 'read', access, 'f', values);
  const source = {
    select: 'f.id, f."name", f."category", f."rulesVariant", f."defaultRating", f."description"',
    from: '"GameType" f',
    where: conditions([admission]),
    values,
    sortColumns: {
      id: 'f.id',
      name: 'f."name"',
      category: 'f."category"',
      rulesVariant: 'f."rulesVariant"',
      defaultRating: 'f."defaultRating"',
      description: 'f."description"',
    },
    searchColumns: {
      name: 'f."name"',
      rulesVariant: 'f."rulesVariant"',
      description: 'f."description"',
    },
    keyColumn: 'f.id',
    derivedFields: ['displayName'],
    numericFields: ['defaultRating'],
  };
  const rows = await readPageRows(
    source,
    parsed,
    async (query) => (await pool.query<Record<string, unknown>>(query.text, query.values)).rows,
    (pageRows) => deriveGameTypeRows(pool, pageRows, access.userId)
  );
  const { page, nextCursor } = pageResult(rows, parsed, 'id');
  const ids = page.map((row) => String(row.id));
  const countQuery = buildCountQuery(source, parsed);
  const counted = await pool.query<{ total: string }>(countQuery.text, countQuery.values);
  const total = Number(counted.rows[0]?.total ?? 0);
  response.json(nextCursor === null ? { ids, total } : { ids, nextCursor, total });
});

gamesRouter.post('/multi-get', async (request, response) => {
  const access = await requireGrant(request, response, 'games', 'read');
  if (access === null) {
    return;
  }
  const body = request.body as { ids?: unknown };
  if (!Array.isArray(body.ids) || !body.ids.every((id) => typeof id === 'string')) {
    response.status(400).json({ error: 'Invalid request body' });
    return;
  }
  if (body.ids.length === 0) {
    response.json([]);
    return;
  }
  const values: unknown[] = [...body.ids];
  const idPlaceholders = body.ids.map((_, index) => `$${index + 1}`).join(', ');
  const owned = ownedColumn('games', 'read', access, 'f', values);
  const admission = admissionClause('games', 'read', access, 'f', values);
  const { rows } = await pool.query<Record<string, unknown>>(
    `SELECT f.id, f."name", f."category", f."rulesVariant", f."defaultRating", f."description", ${owned} FROM "GameType" f${whereClause([`f.id IN (${idPlaceholders})`, admission])}`,
    values
  );
  const columns = admitRows('games', 'read', access.roles, rows);
  response.json(
    projectRows(
      await Promise.all(
        (await deriveGameTypeRows(pool, rows, access.userId)).map((row: Record<string, unknown>) =>
          readableDerivedRows(pool, 'GameType', row, access, 'games', new Set())
        )
      ),
      columns
    )
  );
});

gamesRouter.get('/:id', async (request, response) => {
  const access = await requireGrant(request, response, 'games', 'read');
  if (access === null) {
    return;
  }
  const values: unknown[] = [request.params.id];
  const owned = ownedColumn('games', 'read', access, 'f', values);
  const admission = admissionClause('games', 'read', access, 'f', values);
  const { rows } = await pool.query<Record<string, unknown>>(
    `SELECT f.id, f."name", f."category", f."rulesVariant", f."defaultRating", f."description", ${owned} FROM "GameType" f${whereClause(['f.id = $1', admission])}`,
    values
  );
  if (rows.length === 0) {
    response.status(404).json({ error: 'Not found' });
    return;
  }
  const columns = admitRows('games', 'read', access.roles, rows);
  response.json(
    projectRow(
      await readableDerivedRows(
        pool,
        'GameType',
        await deriveGameType(pool, rows[0], access.userId),
        access,
        'games',
        new Set()
      ),
      columns
    )
  );
});

async function createGameTypeRecord(
  response: RefusalAnswer,
  body: Record<string, unknown>
): Promise<Record<string, unknown> | undefined> {
  if (!isBody(body)) {
    response.status(400).json({ error: 'Invalid request body' });
    return;
  }
  const typedBody: Body = body;
  enforceGameTypeConstraints(typedBody);
  const id = crypto.randomUUID();
  const inserted = await pool.query<Record<string, unknown>>(
    'INSERT INTO "GameType" (id, "name", "category", "rulesVariant", "defaultRating", "description") VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, "name", "category", "rulesVariant", "defaultRating", "description"',
    [
      id,
      typedBody.name,
      typedBody.category === '' ? 'chess' : typedBody.category,
      typedBody.rulesVariant,
      typedBody.defaultRating,
      typedBody.description,
    ]
  );
  const createdRow = inserted.rows[0];
  return createdRow;
}

gamesRouter.post('/', async (request, response) => {
  const access = await requireGrant(request, response, 'games', 'create');
  if (access === null) {
    return;
  }
  const body = request.body as Record<string, unknown>;
  if (typeof body['recordId'] === 'string') {
    response.status(201).json({ success: true });
    return;
  }
  const createdRow = await createGameTypeRecord(response, body);
  if (createdRow === undefined) {
    return;
  }
  const writtenRowColumns = await writtenColumns(pool, 'games', access, createdRow, null);
  response
    .status(201)
    .json(
      projectReadableFields(
        await readableDerivedRows(
          pool,
          'GameType',
          await deriveGameType(pool, createdRow, access.userId),
          access,
          'games',
          new Set()
        ),
        writtenRowColumns
      )
    );
});

gamesRouter.put('/:id', async (request, response) => {
  const access = await requireGrant(request, response, 'games', 'update');
  if (access === null) {
    return;
  }
  const body = request.body as unknown;
  if (!isUpdateBody(body)) {
    response.status(400).json({ error: 'Invalid request body' });
    return;
  }
  const outcome = await withTransaction<WriteOutcome>(
    pool,
    async (client): Promise<WriteOutcome> => {
      const values: unknown[] = [request.params.id];
      const owned = ownedColumn('games', 'update', access, 'f', values);
      const admission = admissionClause('games', 'update', access, 'f', values);
      const existing = await client.query<Record<string, unknown>>(
        `SELECT f.id, f."name", f."category", f."rulesVariant", f."defaultRating", f."description", ${owned} FROM "GameType" f${whereClause(['f.id = $1', admission])} FOR UPDATE`,
        values
      );
      if (existing.rows.length === 0) {
        return { status: 404, error: 'Not found' };
      }
      const existingRow = existing.rows[0];
      const unwritable = unwritableField(
        'games',
        access.roles,
        existingRow,
        ownedFlag(existingRow),
        body
      );
      if (unwritable !== null) {
        return {
          status: 403,
          error: `Field '${unwritable}' is not writable on 'games' for this role`,
        };
      }
      enforceGameTypeConstraints(mergedCandidate(existingRow, body));
      const assigned = assignedColumns([
        ['name', body.name],
        ['category', body.category],
        ['rulesVariant', body.rulesVariant],
        ['defaultRating', body.defaultRating],
        ['description', body.description],
      ]);
      const written = await client.query<Record<string, unknown>>(
        `UPDATE "GameType" SET ${assigned.clause} WHERE id = $${assigned.values.length + 1} RETURNING id, "name", "category", "rulesVariant", "defaultRating", "description"`,
        [...assigned.values, request.params.id]
      );
      return { row: written.rows[0] };
    }
  );
  if (!('row' in outcome)) {
    response.status(outcome.status).json({ error: outcome.error });
    return;
  }
  const writtenRowColumns = await writtenColumns(pool, 'games', access, outcome.row, null);
  response
    .status(200)
    .json(
      projectReadableFields(
        await readableDerivedRows(
          pool,
          'GameType',
          await deriveGameType(pool, outcome.row, access.userId),
          access,
          'games',
          new Set()
        ),
        writtenRowColumns
      )
    );
});

gamesRouter.delete('/:id', async (request, response) => {
  const access = await requireGrant(request, response, 'games', 'delete');
  if (access === null) {
    return;
  }
  const deleteStatus = await withTransaction(
    pool,
    async (client): Promise<'success' | 'not-found'> => {
      const values: unknown[] = [request.params.id];
      const admission = admissionClause('games', 'delete', access, 'f', values);
      const existingItem = await client.query<Record<string, unknown>>(
        `SELECT f.id FROM "GameType" f${whereClause(['f.id = $1', admission])} FOR UPDATE`,
        values
      );
      if (existingItem.rows.length === 0) {
        return 'not-found';
      }
      const deleted = await client.query('DELETE FROM "GameType" WHERE id = $1', [
        request.params.id,
      ]);
      if (deleted.rowCount !== 1) {
        return 'not-found';
      }
      return 'success';
    }
  );
  if (deleteStatus === 'not-found') {
    response.status(404).json({ error: 'Not found' });
    return;
  }
  response.json({ success: true });
});

export const gamesViolationsRouter = Router();

gamesViolationsRouter.get('/', async (request, response) => {
  const access = await requireGrant(request, response, 'games', 'read');
  if (access === null) {
    return;
  }
  const values: unknown[] = [];
  const admission = admissionClause('games', 'read', access, 'f', values);
  const { rows } = await pool.query<Record<string, unknown>>(
    `SELECT f.id FROM "GameType" f${whereClause([admission])}`,
    values
  );
  const visibleIds = rows.map((row) => String(row.id));
  response.json(
    await collectVisibleRuleViolations(
      pool,
      'GameType',
      new Set(visibleIds),
      readableFieldSet('games', access.roles)
    )
  );
});
