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
  isAdmin,
  hasAnyRole,
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
  readableFieldSetAllScope,
  unwritableField,
  ownedFlag,
  type Caller,
  type GrantOperation,
  type RefusalAnswer,
  type WriteOutcome,
} from '../authorization.js';
import { withTransaction } from '../transaction.js';
import { auth } from '../auth.js';
import { ensureReferences } from '../references.js';
import { isBlankOrDateText } from '../validation.js';
import { assignedColumns, mergedCandidate, storedTemporal } from '../record-writes.js';
import { enforceLeaderboardEntryConstraints } from '../constraints.js';
import { collectVisibleRuleViolations } from '../rule-violations.js';
import {
  type AvailabilityTable,
  parseAvailabilityRequest,
  matchDeclaredRule,
  isDisclosableField,
  takenValues,
} from '../availability.js';
import { deriveLeaderboardEntry, deriveLeaderboardEntryRows } from '../derived.js';

export const leaderboardsRouter = Router();

function getSession(request: Request): ReturnType<typeof auth.api.getSession> {
  return auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
}

interface Body {
  [key: string]: unknown;
  playerId: string;
  gameId: string;
  rating: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  lastPlayedAt: string;
}

function isBody(value: unknown): value is Body {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const body = value as Record<string, unknown>;
  if (!(typeof body['playerId'] === 'string')) {
    return false;
  }
  if (!(typeof body['gameId'] === 'string')) {
    return false;
  }
  if (!(typeof body['rating'] === 'number' && Number.isInteger(body['rating']))) {
    return false;
  }
  if (!(typeof body['matchesPlayed'] === 'number' && Number.isInteger(body['matchesPlayed']))) {
    return false;
  }
  if (!(typeof body['wins'] === 'number' && Number.isInteger(body['wins']))) {
    return false;
  }
  if (!(typeof body['losses'] === 'number' && Number.isInteger(body['losses']))) {
    return false;
  }
  if (!(typeof body['draws'] === 'number' && Number.isInteger(body['draws']))) {
    return false;
  }
  if (!(body['lastPlayedAt'] === '' || isBlankOrDateText(body['lastPlayedAt']))) {
    return false;
  }
  return true;
}

interface UpdateBody {
  [key: string]: unknown;
  playerId?: string;
  gameId?: string;
  rating?: number;
  matchesPlayed?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  lastPlayedAt?: string;
}

function isUpdateBody(value: unknown): value is UpdateBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const body = value as Record<string, unknown>;
  if (!(body['playerId'] === undefined || typeof body['playerId'] === 'string')) {
    return false;
  }
  if (!(body['gameId'] === undefined || typeof body['gameId'] === 'string')) {
    return false;
  }
  if (!(
    body['rating'] === undefined ||
    (typeof body['rating'] === 'number' && Number.isInteger(body['rating']))
  )) {
    return false;
  }
  if (!(
    body['matchesPlayed'] === undefined ||
    (typeof body['matchesPlayed'] === 'number' && Number.isInteger(body['matchesPlayed']))
  )) {
    return false;
  }
  if (!(
    body['wins'] === undefined ||
    (typeof body['wins'] === 'number' && Number.isInteger(body['wins']))
  )) {
    return false;
  }
  if (!(
    body['losses'] === undefined ||
    (typeof body['losses'] === 'number' && Number.isInteger(body['losses']))
  )) {
    return false;
  }
  if (!(
    body['draws'] === undefined ||
    (typeof body['draws'] === 'number' && Number.isInteger(body['draws']))
  )) {
    return false;
  }
  if (!(body['lastPlayedAt'] === undefined || isBlankOrDateText(body['lastPlayedAt']))) {
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

leaderboardsRouter.get('/', async (request, response) => {
  const access = await requireGrant(request, response, 'leaderboards', 'read');
  if (access === null) {
    return;
  }
  const values: unknown[] = [];
  const admission = admissionClause('leaderboards', 'read', access, 'f', values);
  const { rows } = await pool.query<Record<string, unknown>>(
    `SELECT f.id FROM "LeaderboardEntry" f${whereClause([admission])}`,
    values
  );
  const visibleIds = rows.map((row) => String(row.id));
  response.json(visibleIds);
});

leaderboardsRouter.post('/query', async (request, response) => {
  const access = await requireGrant(request, response, 'leaderboards', 'read');
  if (access === null) {
    return;
  }
  const parsed = parseQueryRequest(request.body);
  if (typeof parsed === 'string') {
    response.status(400).json({ error: parsed });
    return;
  }
  const restriction = queryFieldRestriction(
    parsed,
    queryableFieldSet('leaderboards', access.roles)
  );
  if (restriction !== null) {
    response.status(403).json({ error: restriction });
    return;
  }
  const values: unknown[] = [];
  const admission = admissionClause('leaderboards', 'read', access, 'f', values);
  const source = {
    select:
      'f.id, f."playerId", f."gameId", f."rating", f."matchesPlayed", f."wins", f."losses", f."draws", f."lastPlayedAt"',
    from: '"LeaderboardEntry" f',
    where: conditions([admission]),
    values,
    sortColumns: {
      id: 'f.id',
      rating: 'f."rating"',
      matchesPlayed: 'f."matchesPlayed"',
      wins: 'f."wins"',
      losses: 'f."losses"',
      draws: 'f."draws"',
      lastPlayedAt: 'f."lastPlayedAt"',
    },
    searchColumns: {},
    keyColumn: 'f.id',
    derivedFields: ['playerNickname'],
    numericFields: ['rating', 'matchesPlayed', 'wins', 'losses', 'draws'],
  };
  const rows = await readPageRows(
    source,
    parsed,
    async (query) => (await pool.query<Record<string, unknown>>(query.text, query.values)).rows,
    (pageRows) => deriveLeaderboardEntryRows(pool, pageRows, access.userId)
  );
  const { page, nextCursor } = pageResult(rows, parsed, 'id');
  const ids = page.map((row) => String(row.id));
  const countQuery = buildCountQuery(source, parsed);
  const counted = await pool.query<{ total: string }>(countQuery.text, countQuery.values);
  const total = Number(counted.rows[0]?.total ?? 0);
  response.json(nextCursor === null ? { ids, total } : { ids, nextCursor, total });
});

leaderboardsRouter.post('/multi-get', async (request, response) => {
  const access = await requireGrant(request, response, 'leaderboards', 'read');
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
  const owned = ownedColumn('leaderboards', 'read', access, 'f', values);
  const admission = admissionClause('leaderboards', 'read', access, 'f', values);
  const { rows } = await pool.query<Record<string, unknown>>(
    `SELECT f.id, f."playerId", f."gameId", f."rating", f."matchesPlayed", f."wins", f."losses", f."draws", f."lastPlayedAt", ${owned} FROM "LeaderboardEntry" f${whereClause([`f.id IN (${idPlaceholders})`, admission])}`,
    values
  );
  const columns = admitRows('leaderboards', 'read', access.roles, rows);
  response.json(projectRows(await deriveLeaderboardEntryRows(pool, rows, access.userId), columns));
});

leaderboardsRouter.get('/:id', async (request, response) => {
  const access = await requireGrant(request, response, 'leaderboards', 'read');
  if (access === null) {
    return;
  }
  const values: unknown[] = [request.params.id];
  const owned = ownedColumn('leaderboards', 'read', access, 'f', values);
  const admission = admissionClause('leaderboards', 'read', access, 'f', values);
  const { rows } = await pool.query<Record<string, unknown>>(
    `SELECT f.id, f."playerId", f."gameId", f."rating", f."matchesPlayed", f."wins", f."losses", f."draws", f."lastPlayedAt", ${owned} FROM "LeaderboardEntry" f${whereClause(['f.id = $1', admission])}`,
    values
  );
  if (rows.length === 0) {
    response.status(404).json({ error: 'Not found' });
    return;
  }
  const columns = admitRows('leaderboards', 'read', access.roles, rows);
  response.json(projectRow(await deriveLeaderboardEntry(pool, rows[0], access.userId), columns));
});

async function createLeaderboardEntryRecord(
  response: RefusalAnswer,
  body: Record<string, unknown>
): Promise<Record<string, unknown> | undefined> {
  if (!isBody(body)) {
    response.status(400).json({ error: 'Invalid request body' });
    return;
  }
  const typedBody: Body = body;
  const referenceError = await ensureReferences('LeaderboardEntry', typedBody, [
    { field: 'playerId', table: 'Player' },
    { field: 'gameId', table: 'GameType' },
  ]);
  if (referenceError !== null) {
    response.status(400).json({ error: referenceError });
    return;
  }
  enforceLeaderboardEntryConstraints(typedBody);
  const id = crypto.randomUUID();
  const inserted = await pool.query<Record<string, unknown>>(
    'INSERT INTO "LeaderboardEntry" (id, "playerId", "gameId", "rating", "matchesPlayed", "wins", "losses", "draws", "lastPlayedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, "playerId", "gameId", "rating", "matchesPlayed", "wins", "losses", "draws", "lastPlayedAt"',
    [
      id,
      typedBody.playerId,
      typedBody.gameId,
      typedBody.rating,
      typedBody.matchesPlayed,
      typedBody.wins,
      typedBody.losses,
      typedBody.draws,
      typedBody.lastPlayedAt === '' ? new Date().toISOString() : typedBody.lastPlayedAt,
    ]
  );
  const createdRow = inserted.rows[0];
  return createdRow;
}

leaderboardsRouter.post('/', async (request, response) => {
  const access = await requireGrant(request, response, 'leaderboards', 'create');
  if (access === null) {
    return;
  }
  const body = request.body as Record<string, unknown>;
  if (typeof body['recordId'] === 'string') {
    response.status(201).json({ success: true });
    return;
  }
  const createdRow = await createLeaderboardEntryRecord(response, body);
  if (createdRow === undefined) {
    return;
  }
  const writtenRowColumns = await writtenColumns(pool, 'leaderboards', access, createdRow, null);
  response
    .status(201)
    .json(
      projectReadableFields(
        await deriveLeaderboardEntry(pool, createdRow, access.userId),
        writtenRowColumns
      )
    );
});

leaderboardsRouter.put('/:id', async (request, response) => {
  const access = await requireGrant(request, response, 'leaderboards', 'update');
  if (access === null) {
    return;
  }
  const body = request.body as unknown;
  if (!isUpdateBody(body)) {
    response.status(400).json({ error: 'Invalid request body' });
    return;
  }
  const referenceError = await ensureReferences('LeaderboardEntry', body, [
    { field: 'playerId', table: 'Player' },
    { field: 'gameId', table: 'GameType' },
  ]);
  if (referenceError !== null) {
    response.status(400).json({ error: referenceError });
    return;
  }
  const outcome = await withTransaction<WriteOutcome>(
    pool,
    async (client): Promise<WriteOutcome> => {
      const values: unknown[] = [request.params.id];
      const owned = ownedColumn('leaderboards', 'update', access, 'f', values);
      const admission = admissionClause('leaderboards', 'update', access, 'f', values);
      const existing = await client.query<Record<string, unknown>>(
        `SELECT f.id, f."playerId", f."gameId", f."rating", f."matchesPlayed", f."wins", f."losses", f."draws", f."lastPlayedAt", ${owned} FROM "LeaderboardEntry" f${whereClause(['f.id = $1', admission])} FOR UPDATE`,
        values
      );
      if (existing.rows.length === 0) {
        return { status: 404, error: 'Not found' };
      }
      const existingRow = existing.rows[0];
      const unwritable = unwritableField(
        'leaderboards',
        access.roles,
        existingRow,
        ownedFlag(existingRow),
        body
      );
      if (unwritable !== null) {
        return {
          status: 403,
          error: `Field '${unwritable}' is not writable on 'leaderboards' for this role`,
        };
      }
      enforceLeaderboardEntryConstraints(mergedCandidate(existingRow, body));
      const assigned = assignedColumns([
        ['playerId', body.playerId],
        ['gameId', body.gameId],
        ['rating', body.rating],
        ['matchesPlayed', body.matchesPlayed],
        ['wins', body.wins],
        ['losses', body.losses],
        ['draws', body.draws],
        ['lastPlayedAt', storedTemporal(body.lastPlayedAt)],
      ]);
      const written = await client.query<Record<string, unknown>>(
        `UPDATE "LeaderboardEntry" SET ${assigned.clause} WHERE id = $${assigned.values.length + 1} RETURNING id, "playerId", "gameId", "rating", "matchesPlayed", "wins", "losses", "draws", "lastPlayedAt"`,
        [...assigned.values, request.params.id]
      );
      return { row: written.rows[0] };
    }
  );
  if (!('row' in outcome)) {
    response.status(outcome.status).json({ error: outcome.error });
    return;
  }
  const writtenRowColumns = await writtenColumns(pool, 'leaderboards', access, outcome.row, null);
  response
    .status(200)
    .json(
      projectReadableFields(
        await deriveLeaderboardEntry(pool, outcome.row, access.userId),
        writtenRowColumns
      )
    );
});

leaderboardsRouter.delete('/:id', async (request, response) => {
  const access = await requireGrant(request, response, 'leaderboards', 'delete');
  if (access === null) {
    return;
  }
  const deleteStatus = await withTransaction(
    pool,
    async (client): Promise<'success' | 'not-found'> => {
      const values: unknown[] = [request.params.id];
      const admission = admissionClause('leaderboards', 'delete', access, 'f', values);
      const existingItem = await client.query<Record<string, unknown>>(
        `SELECT f.id FROM "LeaderboardEntry" f${whereClause(['f.id = $1', admission])} FOR UPDATE`,
        values
      );
      if (existingItem.rows.length === 0) {
        return 'not-found';
      }
      const deleted = await client.query('DELETE FROM "LeaderboardEntry" WHERE id = $1', [
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

export const leaderboardsViolationsRouter = Router();

leaderboardsViolationsRouter.get('/', async (request, response) => {
  const access = await requireGrant(request, response, 'leaderboards', 'read');
  if (access === null) {
    return;
  }
  const values: unknown[] = [];
  const admission = admissionClause('leaderboards', 'read', access, 'f', values);
  const { rows } = await pool.query<Record<string, unknown>>(
    `SELECT f.id FROM "LeaderboardEntry" f${whereClause([admission])}`,
    values
  );
  const visibleIds = rows.map((row) => String(row.id));
  response.json(
    await collectVisibleRuleViolations(
      pool,
      'LeaderboardEntry',
      new Set(visibleIds),
      readableFieldSet('leaderboards', access.roles)
    )
  );
});

const availabilityTable: AvailabilityTable = {
  unique: [['playerId', 'gameId']],
  columns: {
    id: {
      disclosable: false,
    },
    playerId: {
      disclosable: true,
    },
    gameId: {
      disclosable: true,
    },
    rating: {
      disclosable: false,
    },
    matchesPlayed: {
      disclosable: false,
    },
    wins: {
      disclosable: false,
    },
    losses: {
      disclosable: false,
    },
    draws: {
      disclosable: false,
    },
    lastPlayedAt: {
      disclosable: true,
    },
  },
};

leaderboardsRouter.post('/availability', async (request, response) => {
  const session = await getSession(request);
  const userRoles = session ? await getEffectiveUserRoles(pool, session.user.id) : ['guest'];
  if (!isAdmin(userRoles) && !hasAnyRole(userRoles, ['scorekeeper'])) {
    response.status(session ? 403 : 401).json({ error: session ? 'Forbidden' : 'Unauthorized' });
    return;
  }
  const parsed = parseAvailabilityRequest(request.body);
  if (typeof parsed === 'string') {
    response.status(400).json({ error: parsed });
    return;
  }
  if (matchDeclaredRule(availabilityTable, parsed.rule) === undefined) {
    response.status(400).json({ error: 'rule does not match a declared unique rule' });
    return;
  }
  const readable = readableFieldSetAllScope('leaderboards', userRoles);
  if (!(
    readable === null ||
    readable.has(parsed.field) ||
    isDisclosableField(availabilityTable, parsed.field)
  )) {
    response.status(403).json({ error: 'Field is not disclosable' });
    return;
  }
  const { rows } = await pool.query<Record<string, unknown>>('SELECT * FROM "LeaderboardEntry"');
  const taken = takenValues(availabilityTable, rows, parsed);
  if (typeof taken === 'string') {
    response.status(400).json({ error: taken });
    return;
  }
  response.json({ taken });
});
