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
  unwritableField,
  ownedFlag,
  type Caller,
  type GrantOperation,
  type RefusalAnswer,
  type WriteOutcome,
} from '../authorization.js';
import { withTransaction } from '../transaction.js';
import { auth } from '../auth.js';
import { nothingStored, storedColumns, unreadableReference } from '../reference-access.js';
import { isBlankOrDateText } from '../validation.js';
import { assignedColumns, mergedCandidate, storedTemporal } from '../record-writes.js';
import { enforceMatchConstraints, ConstraintViolationError, formattedRow } from '../constraints.js';
import { collectVisibleRuleViolations } from '../rule-violations.js';
import { deriveMatch, deriveMatchRows } from '../derived.js';

export const matchesRouter = Router();

function getSession(request: Request): ReturnType<typeof auth.api.getSession> {
  return auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
}

interface Body {
  [key: string]: unknown;
  gameId?: string;
  playerOneId?: string;
  playerTwoId?: string;
  scheduledAt?: string;
  status?: string;
  outcome?: string;
  notes?: string;
}

function isBody(value: unknown): value is Body {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const body = value as Record<string, unknown>;
  if (!(body['gameId'] === undefined || typeof body['gameId'] === 'string')) {
    return false;
  }
  if (!(body['playerOneId'] === undefined || typeof body['playerOneId'] === 'string')) {
    return false;
  }
  if (!(body['playerTwoId'] === undefined || typeof body['playerTwoId'] === 'string')) {
    return false;
  }
  if (!(
    body['scheduledAt'] === undefined ||
    body['scheduledAt'] === '' ||
    isBlankOrDateText(body['scheduledAt'])
  )) {
    return false;
  }
  if (!(
    body['status'] === undefined ||
    body['status'] === '' ||
    (typeof body['status'] === 'string' &&
      ['scheduled', 'inProgress', 'completed', 'disputed', 'cancelled'].includes(body['status']))
  )) {
    return false;
  }
  if (!(
    body['outcome'] === undefined ||
    body['outcome'] === '' ||
    (typeof body['outcome'] === 'string' &&
      ['playerOneWin', 'playerTwoWin', 'draw'].includes(body['outcome']))
  )) {
    return false;
  }
  if (!(body['notes'] === undefined || typeof body['notes'] === 'string')) {
    return false;
  }
  return true;
}

interface UpdateBody {
  [key: string]: unknown;
  gameId?: string;
  playerOneId?: string;
  playerTwoId?: string;
  scheduledAt?: string;
  status?: string;
  outcome?: string;
  notes?: string;
}

function isUpdateBody(value: unknown): value is UpdateBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const body = value as Record<string, unknown>;
  if (!(body['gameId'] === undefined || typeof body['gameId'] === 'string')) {
    return false;
  }
  if (!(body['playerOneId'] === undefined || typeof body['playerOneId'] === 'string')) {
    return false;
  }
  if (!(body['playerTwoId'] === undefined || typeof body['playerTwoId'] === 'string')) {
    return false;
  }
  if (!(body['scheduledAt'] === undefined || isBlankOrDateText(body['scheduledAt']))) {
    return false;
  }
  if (!(
    body['status'] === undefined ||
    (typeof body['status'] === 'string' &&
      ['scheduled', 'inProgress', 'completed', 'disputed', 'cancelled'].includes(body['status']))
  )) {
    return false;
  }
  if (!(
    body['outcome'] === undefined ||
    (typeof body['outcome'] === 'string' &&
      ['playerOneWin', 'playerTwoWin', 'draw'].includes(body['outcome']))
  )) {
    return false;
  }
  if (!(body['notes'] === undefined || typeof body['notes'] === 'string')) {
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

matchesRouter.get('/', async (request, response) => {
  const access = await requireGrant(request, response, 'matches', 'read');
  if (access === null) {
    return;
  }
  const values: unknown[] = [];
  const admission = admissionClause('matches', 'read', access, 'f', values);
  const { rows } = await pool.query<Record<string, unknown>>(
    `SELECT f.id FROM "Match" f${whereClause([admission])}`,
    values
  );
  const visibleIds = rows.map((row) => String(row.id));
  response.json(visibleIds);
});

matchesRouter.post('/query', async (request, response) => {
  const access = await requireGrant(request, response, 'matches', 'read');
  if (access === null) {
    return;
  }
  const parsed = parseQueryRequest(request.body);
  if (typeof parsed === 'string') {
    response.status(400).json({ error: parsed });
    return;
  }
  const restriction = queryFieldRestriction(parsed, queryableFieldSet('matches', access.roles));
  if (restriction !== null) {
    response.status(403).json({ error: restriction });
    return;
  }
  const values: unknown[] = [];
  const admission = admissionClause('matches', 'read', access, 'f', values);
  const source = {
    select:
      'f.id, f."gameId", f."playerOneId", f."playerTwoId", f."scheduledAt", f."status", f."outcome", f."playerOneScore", f."playerTwoScore", f."playerOneRatingDelta", f."playerTwoRatingDelta", f."notes", f."recordedById", f."createdAt"',
    from: '"Match" f',
    where: conditions([admission]),
    values,
    sortColumns: {
      id: 'f.id',
      scheduledAt: 'f."scheduledAt"',
      status: 'f."status"',
      outcome: 'f."outcome"',
      playerOneScore: 'f."playerOneScore"',
      playerTwoScore: 'f."playerTwoScore"',
      playerOneRatingDelta: 'f."playerOneRatingDelta"',
      playerTwoRatingDelta: 'f."playerTwoRatingDelta"',
      notes: 'f."notes"',
      createdAt: 'f."createdAt"',
    },
    searchColumns: { notes: 'f."notes"' },
    keyColumn: 'f.id',
    derivedFields: ['title', 'gameDisplayName'],
    numericFields: [
      'playerOneScore',
      'playerTwoScore',
      'playerOneRatingDelta',
      'playerTwoRatingDelta',
    ],
  };
  const rows = await readPageRows(
    source,
    parsed,
    async (query) => (await pool.query<Record<string, unknown>>(query.text, query.values)).rows,
    (pageRows) => deriveMatchRows(pool, pageRows, access.userId)
  );
  const { page, nextCursor } = pageResult(rows, parsed, 'id');
  const ids = page.map((row) => String(row.id));
  const countQuery = buildCountQuery(source, parsed);
  const counted = await pool.query<{ total: string }>(countQuery.text, countQuery.values);
  const total = Number(counted.rows[0]?.total ?? 0);
  response.json(nextCursor === null ? { ids, total } : { ids, nextCursor, total });
});

matchesRouter.post('/multi-get', async (request, response) => {
  const access = await requireGrant(request, response, 'matches', 'read');
  if (access === null) {
    return;
  }
  const body = request.body as { ids?: unknown };
  if (!Array.isArray(body.ids) || !body.ids.every((id) => typeof id === 'string')) {
    response.status(400).json({ error: 'Invalid request body' });
    return;
  }
  if (body.ids.length > 200) {
    response.status(400).json({ error: 'ids must list at most 200 records' });
    return;
  }
  if (body.ids.length === 0) {
    response.json([]);
    return;
  }
  const values: unknown[] = [...body.ids];
  const idPlaceholders = body.ids.map((_, index) => `$${index + 1}`).join(', ');
  const owned = ownedColumn('matches', 'read', access, 'f', values);
  const admission = admissionClause('matches', 'read', access, 'f', values);
  const { rows } = await pool.query<Record<string, unknown>>(
    `SELECT f.id, f."gameId", f."playerOneId", f."playerTwoId", f."scheduledAt", f."status", f."outcome", f."playerOneScore", f."playerTwoScore", f."playerOneRatingDelta", f."playerTwoRatingDelta", f."notes", f."recordedById", f."createdAt", ${owned} FROM "Match" f${whereClause([`f.id IN (${idPlaceholders})`, admission])}`,
    values
  );
  const columns = admitRows('matches', 'read', access.roles, rows);
  response.json(projectRows(await deriveMatchRows(pool, rows, access.userId), columns));
});

matchesRouter.get('/:id', async (request, response) => {
  const access = await requireGrant(request, response, 'matches', 'read');
  if (access === null) {
    return;
  }
  const values: unknown[] = [request.params.id];
  const owned = ownedColumn('matches', 'read', access, 'f', values);
  const admission = admissionClause('matches', 'read', access, 'f', values);
  const { rows } = await pool.query<Record<string, unknown>>(
    `SELECT f.id, f."gameId", f."playerOneId", f."playerTwoId", f."scheduledAt", f."status", f."outcome", f."playerOneScore", f."playerTwoScore", f."playerOneRatingDelta", f."playerTwoRatingDelta", f."notes", f."recordedById", f."createdAt", ${owned} FROM "Match" f${whereClause(['f.id = $1', admission])}`,
    values
  );
  if (rows.length === 0) {
    response.status(404).json({ error: 'Not found' });
    return;
  }
  const columns = admitRows('matches', 'read', access.roles, rows);
  response.json(projectRow(await deriveMatch(pool, rows[0], access.userId), columns));
});

async function createMatchRecord(
  response: RefusalAnswer,
  body: Record<string, unknown>,
  owner: string,
  caller: Caller
): Promise<Record<string, unknown> | undefined> {
  if (!isBody(body)) {
    response.status(400).json({ error: 'Invalid request body' });
    return;
  }
  for (const key of [
    'playerOneScore',
    'playerTwoScore',
    'playerOneRatingDelta',
    'playerTwoRatingDelta',
    'recordedById',
    'createdAt',
  ]) {
    if (key in body) {
      response.status(422).json({
        error: `Field '${key}' is internal and cannot be written by a client`,
        code: 'PRECONDITION_FAILED',
      });
      return;
    }
  }
  const typedBody: Body = formattedRow('Match', {
    ...body,
    gameId: body.gameId ?? '',
    playerOneId: body.playerOneId ?? '',
    playerTwoId: body.playerTwoId ?? '',
    scheduledAt:
      body.scheduledAt === undefined || body.scheduledAt === ''
        ? new Date().toISOString()
        : body.scheduledAt,
    status: body.status === undefined || body.status === '' ? 'scheduled' : body.status,
    outcome: body.outcome === undefined || body.outcome === '' ? 'playerOneWin' : body.outcome,
    notes: body.notes ?? '',
  });
  const unreadableField = await unreadableReference(
    [typedBody],
    [
      { field: 'gameId', table: 'GameType' },
      { field: 'playerOneId', table: 'Player' },
      { field: 'playerTwoId', table: 'Player' },
      { field: 'recordedById', table: 'user' },
    ],
    caller,
    nothingStored
  );
  if (unreadableField !== null) {
    throw new ConstraintViolationError({
      kind: 'referenceGone',
      type: 'Match',
      field: unreadableField,
    });
  }
  enforceMatchConstraints(typedBody);
  const id = crypto.randomUUID();
  const createdRow = await withTransaction<Record<string, unknown>>(
    pool,
    async (client): Promise<Record<string, unknown>> => {
      const inserted = await client.query<Record<string, unknown>>(
        'INSERT INTO "Match" (id, "gameId", "playerOneId", "playerTwoId", "scheduledAt", "status", "outcome", "notes", "playerOneScore", "playerTwoScore", "playerOneRatingDelta", "playerTwoRatingDelta", "createdAt", "recordedById") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id, "gameId", "playerOneId", "playerTwoId", "scheduledAt", "status", "outcome", "playerOneScore", "playerTwoScore", "playerOneRatingDelta", "playerTwoRatingDelta", "notes", "recordedById", "createdAt"',
        [
          id,
          typedBody.gameId,
          typedBody.playerOneId,
          typedBody.playerTwoId,
          storedTemporal(typedBody.scheduledAt),
          typedBody.status,
          typedBody.outcome,
          typedBody.notes,
          0,
          0,
          0,
          0,
          new Date().toISOString(),
          owner,
        ]
      );
      await client.query('INSERT INTO "creator_matches" ("matchId", "userId") VALUES ($1, $2)', [
        id,
        owner,
      ]);
      return inserted.rows[0];
    }
  );
  return createdRow;
}

matchesRouter.post('/', async (request, response) => {
  const access = await requireGrant(request, response, 'matches', 'create');
  if (access === null) {
    return;
  }
  const body = request.body as Record<string, unknown>;
  if (typeof body['recordId'] === 'string') {
    const recordValues: unknown[] = [body['recordId']];
    const recordAdmission = hasGrant('matches', 'read', access.roles)
      ? admissionClause('matches', 'read', access, 'f', recordValues)
      : 'FALSE';
    const readableRecord = await pool.query(
      `SELECT 1 FROM "Match" f${whereClause(['f.id = $1', recordAdmission])}`,
      recordValues
    );
    if (readableRecord.rows.length === 0) {
      response.status(404).json({ error: 'Record not found' });
      return;
    }
    if (access.userId === null) {
      response
        .status(401)
        .json({ error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED' });
      return;
    }
    const claimedId = body['recordId'];
    const claimant = access.userId;
    const claimed = await withTransaction<'ok' | 'missing' | 'owned'>(
      pool,
      async (client): Promise<'ok' | 'missing' | 'owned'> => {
        const record = await client.query('SELECT 1 FROM "Match" WHERE id = $1', [claimedId]);
        if (record.rowCount === 0) {
          return 'missing';
        }
        const creator = await client.query<{ userId: string }>(
          'SELECT "userId" FROM "creator_matches" WHERE "matchId" = $1',
          [claimedId]
        );
        if (creator.rows.some((row) => row.userId !== claimant)) {
          return 'owned';
        }
        const authored = creator.rows.length > 0 ? claimant : '';
        await client.query(
          'INSERT INTO "creator_matches" ("matchId", "userId") VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [claimedId, authored]
        );
        return 'ok';
      }
    );
    if (claimed === 'missing') {
      response.status(404).json({ error: 'Record not found' });
      return;
    }
    if (claimed === 'owned') {
      response.status(403).json({ error: 'Record is owned by another user' });
      return;
    }
    response.status(201).json({ success: true });
    return;
  }
  const createdRow = await createMatchRecord(response, body, access.userId ?? '', access);
  if (createdRow === undefined) {
    return;
  }
  const writtenRowColumns = await writtenColumns(pool, 'matches', access, createdRow, null);
  response
    .status(201)
    .json(
      projectReadableFields(await deriveMatch(pool, createdRow, access.userId), writtenRowColumns)
    );
});

matchesRouter.put('/:id', async (request, response) => {
  const access = await requireGrant(request, response, 'matches', 'update');
  if (access === null) {
    return;
  }
  const body = request.body as unknown;
  if (!isUpdateBody(body)) {
    response.status(400).json({ error: 'Invalid request body' });
    return;
  }
  for (const key of [
    'playerOneScore',
    'playerTwoScore',
    'playerOneRatingDelta',
    'playerTwoRatingDelta',
    'recordedById',
    'createdAt',
  ]) {
    if (key in body) {
      response.status(422).json({
        error: `Field '${key}' is internal and cannot be written by a client`,
        code: 'PRECONDITION_FAILED',
      });
      return;
    }
  }
  const unreadableField = await unreadableReference(
    [body],
    [
      { field: 'gameId', table: 'GameType' },
      { field: 'playerOneId', table: 'Player' },
      { field: 'playerTwoId', table: 'Player' },
      { field: 'recordedById', table: 'user' },
    ],
    access,
    () =>
      storedColumns('Match', request.params.id, [
        'gameId',
        'playerOneId',
        'playerTwoId',
        'recordedById',
      ])
  );
  if (unreadableField !== null) {
    throw new ConstraintViolationError({
      kind: 'referenceGone',
      type: 'Match',
      field: unreadableField,
    });
  }
  const outcome = await withTransaction<WriteOutcome>(
    pool,
    async (client): Promise<WriteOutcome> => {
      const values: unknown[] = [request.params.id];
      const owned = ownedColumn('matches', 'update', access, 'f', values);
      const admission = admissionClause('matches', 'update', access, 'f', values);
      const existing = await client.query<Record<string, unknown>>(
        `SELECT f.id, f."gameId", f."playerOneId", f."playerTwoId", f."scheduledAt", f."status", f."outcome", f."playerOneScore", f."playerTwoScore", f."playerOneRatingDelta", f."playerTwoRatingDelta", f."notes", f."recordedById", f."createdAt", ${owned} FROM "Match" f${whereClause(['f.id = $1', admission])} FOR UPDATE`,
        values
      );
      if (existing.rows.length === 0) {
        return { status: 404, error: 'Not found' };
      }
      const existingRow = existing.rows[0];
      const unwritable = unwritableField(
        'matches',
        access.roles,
        existingRow,
        ownedFlag(existingRow),
        body
      );
      if (unwritable !== null) {
        return {
          status: 403,
          error: `Field '${unwritable}' is not writable on 'matches' for this role`,
        };
      }
      enforceMatchConstraints(mergedCandidate(existingRow, body));
      const assigned = assignedColumns([
        ['gameId', body.gameId],
        ['playerOneId', body.playerOneId],
        ['playerTwoId', body.playerTwoId],
        ['scheduledAt', storedTemporal(body.scheduledAt)],
        ['status', body.status],
        ['outcome', body.outcome],
        ['notes', body.notes],
      ]);
      const written = await client.query<Record<string, unknown>>(
        `UPDATE "Match" SET ${assigned.clause} WHERE id = $${assigned.values.length + 1} RETURNING id, "gameId", "playerOneId", "playerTwoId", "scheduledAt", "status", "outcome", "playerOneScore", "playerTwoScore", "playerOneRatingDelta", "playerTwoRatingDelta", "notes", "recordedById", "createdAt"`,
        [...assigned.values, request.params.id]
      );
      return { row: written.rows[0] };
    }
  );
  if (!('row' in outcome)) {
    response.status(outcome.status).json({ error: outcome.error });
    return;
  }
  const writtenRowColumns = await writtenColumns(pool, 'matches', access, outcome.row, null);
  response
    .status(200)
    .json(
      projectReadableFields(await deriveMatch(pool, outcome.row, access.userId), writtenRowColumns)
    );
});

matchesRouter.delete('/:id', async (request, response) => {
  const access = await requireGrant(request, response, 'matches', 'delete');
  if (access === null) {
    return;
  }
  const deleteStatus = await withTransaction(
    pool,
    async (client): Promise<'success' | 'not-found'> => {
      const values: unknown[] = [request.params.id];
      const admission = admissionClause('matches', 'delete', access, 'f', values);
      const existingItem = await client.query<Record<string, unknown>>(
        `SELECT f.id FROM "Match" f${whereClause(['f.id = $1', admission])} FOR UPDATE`,
        values
      );
      if (existingItem.rows.length === 0) {
        return 'not-found';
      }
      await client.query('DELETE FROM "creator_matches" WHERE "matchId" = $1', [request.params.id]);
      const deleted = await client.query('DELETE FROM "Match" WHERE id = $1', [request.params.id]);
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

export const matchesViolationsRouter = Router();

matchesViolationsRouter.get('/', async (request, response) => {
  const access = await requireGrant(request, response, 'matches', 'read');
  if (access === null) {
    return;
  }
  const values: unknown[] = [];
  const owned = ownedColumn('matches', 'read', access, 'f', values);
  const admission = admissionClause('matches', 'read', access, 'f', values);
  const { rows } = await pool.query<Record<string, unknown>>(
    `SELECT f.*, ${owned} FROM "Match" f${whereClause([admission])}`,
    values
  );
  response.json(
    await collectVisibleRuleViolations(
      pool,
      'Match',
      admitRows('matches', 'read', access.roles, rows)
    )
  );
});
