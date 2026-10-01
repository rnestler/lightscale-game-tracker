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
  readColumns,
  writtenColumns,
  queryableFieldSet,
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
import { nothingStored, storedColumns, unreadableReference } from '../reference-access.js';
import { unreadableFile } from '../file-access.js';
import { hiddenCollision, shadowRecord } from '../identity-collision.js';
import {
  stageFiles,
  storeStagedFiles,
  type StagedFile,
  enrichRow,
  isFileBodyValue,
  type FileBodyValue,
} from '../files.js';
import { isBlankOrDateText } from '../validation.js';
import { assignedColumns, mergedCandidate, storedTemporal } from '../record-writes.js';
import {
  enforcePlayerConstraints,
  ConstraintViolationError,
  formattedRow,
  formatFields,
} from '../constraints.js';
import { collectVisibleRuleViolations } from '../rule-violations.js';
import {
  type AvailabilityTable,
  parseAvailabilityRequest,
  matchDeclaredRule,
  isDisclosableField,
  takenValues,
} from '../availability.js';

export const playersRouter = Router();

function getSession(request: Request): ReturnType<typeof auth.api.getSession> {
  return auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
}

interface Body {
  [key: string]: unknown;
  nickname?: string;
  fullName?: string;
  emailAddress?: string;
  avatar?: FileBodyValue;
  bio?: string;
  joinedDate?: string;
  userAccountId?: string;
}

function isBody(value: unknown): value is Body {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const body = value as Record<string, unknown>;
  if (!(body['nickname'] === undefined || typeof body['nickname'] === 'string')) {
    return false;
  }
  if (!(body['fullName'] === undefined || typeof body['fullName'] === 'string')) {
    return false;
  }
  if (!(body['emailAddress'] === undefined || typeof body['emailAddress'] === 'string')) {
    return false;
  }
  if (!(body['avatar'] === undefined || isFileBodyValue(body['avatar']))) {
    return false;
  }
  if (!(body['bio'] === undefined || typeof body['bio'] === 'string')) {
    return false;
  }
  if (!(
    body['joinedDate'] === undefined ||
    body['joinedDate'] === '' ||
    isBlankOrDateText(body['joinedDate'])
  )) {
    return false;
  }
  if (!(body['userAccountId'] === undefined || typeof body['userAccountId'] === 'string')) {
    return false;
  }
  return true;
}

interface UpdateBody {
  [key: string]: unknown;
  nickname?: string;
  fullName?: string;
  emailAddress?: string;
  avatar?: FileBodyValue;
  bio?: string;
  joinedDate?: string;
  userAccountId?: string;
}

function isUpdateBody(value: unknown): value is UpdateBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const body = value as Record<string, unknown>;
  if (!(body['nickname'] === undefined || typeof body['nickname'] === 'string')) {
    return false;
  }
  if (!(body['fullName'] === undefined || typeof body['fullName'] === 'string')) {
    return false;
  }
  if (!(body['emailAddress'] === undefined || typeof body['emailAddress'] === 'string')) {
    return false;
  }
  if (!(body['avatar'] === undefined || isFileBodyValue(body['avatar']))) {
    return false;
  }
  if (!(body['bio'] === undefined || typeof body['bio'] === 'string')) {
    return false;
  }
  if (!(body['joinedDate'] === undefined || isBlankOrDateText(body['joinedDate']))) {
    return false;
  }
  if (!(body['userAccountId'] === undefined || typeof body['userAccountId'] === 'string')) {
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

playersRouter.get('/', async (request, response) => {
  const access = await requireGrant(request, response, 'players', 'read');
  if (access === null) {
    return;
  }
  const values: unknown[] = [];
  const admission = admissionClause('players', 'read', access, 'f', values);
  const { rows } = await pool.query<Record<string, unknown>>(
    `SELECT f.id FROM "Player" f${whereClause([admission])}`,
    values
  );
  const visibleIds = rows.map((row) => String(row.id));
  response.json(visibleIds);
});

playersRouter.post('/query', async (request, response) => {
  const access = await requireGrant(request, response, 'players', 'read');
  if (access === null) {
    return;
  }
  const parsed = parseQueryRequest(request.body);
  if (typeof parsed === 'string') {
    response.status(400).json({ error: parsed });
    return;
  }
  const restriction = queryFieldRestriction(parsed, queryableFieldSet('players', access.roles));
  if (restriction !== null) {
    response.status(403).json({ error: restriction });
    return;
  }
  const values: unknown[] = [];
  const admission = admissionClause('players', 'read', access, 'f', values);
  const source = {
    select:
      'f.id, f."nickname", f."fullName", f."emailAddress", f."avatar", f."bio", f."joinedDate", f."userAccountId"',
    from: '"Player" f',
    where: conditions([admission]),
    values,
    sortColumns: {
      id: 'f.id',
      nickname: 'f."nickname"',
      fullName: 'f."fullName"',
      emailAddress: 'f."emailAddress"',
      bio: 'f."bio"',
      joinedDate: 'f."joinedDate"',
    },
    searchColumns: {
      nickname: 'f."nickname"',
      fullName: 'f."fullName"',
      emailAddress: 'f."emailAddress"',
      bio: 'f."bio"',
    },
    keyColumn: 'f.id',
    derivedFields: [],
    numericFields: [],
  };
  const rows = await readPageRows(
    source,
    parsed,
    async (query) => (await pool.query<Record<string, unknown>>(query.text, query.values)).rows,
    null
  );
  const { page, nextCursor } = pageResult(rows, parsed, 'id');
  const ids = page.map((row) => String(row.id));
  const countQuery = buildCountQuery(source, parsed);
  const counted = await pool.query<{ total: string }>(countQuery.text, countQuery.values);
  const total = Number(counted.rows[0]?.total ?? 0);
  response.json(nextCursor === null ? { ids, total } : { ids, nextCursor, total });
});

playersRouter.post('/multi-get', async (request, response) => {
  const access = await requireGrant(request, response, 'players', 'read');
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
  const owned = ownedColumn('players', 'read', access, 'f', values);
  const admission = admissionClause('players', 'read', access, 'f', values);
  const { rows } = await pool.query<Record<string, unknown>>(
    `SELECT f.id, f."nickname", f."fullName", f."emailAddress", f."avatar", f."bio", f."joinedDate", f."userAccountId", ${owned} FROM "Player" f${whereClause([`f.id IN (${idPlaceholders})`, admission])}`,
    values
  );
  const columns = admitRows('players', 'read', access.roles, rows);
  response.json(
    projectRows(
      await Promise.all(rows.map((row: Record<string, unknown>) => enrichRow(row, ['avatar']))),
      columns
    )
  );
});

playersRouter.get('/:id', async (request, response) => {
  const access = await requireGrant(request, response, 'players', 'read');
  if (access === null) {
    return;
  }
  const values: unknown[] = [request.params.id];
  const owned = ownedColumn('players', 'read', access, 'f', values);
  const admission = admissionClause('players', 'read', access, 'f', values);
  const { rows } = await pool.query<Record<string, unknown>>(
    `SELECT f.id, f."nickname", f."fullName", f."emailAddress", f."avatar", f."bio", f."joinedDate", f."userAccountId", ${owned} FROM "Player" f${whereClause(['f.id = $1', admission])}`,
    values
  );
  if (rows.length === 0) {
    response.status(404).json({ error: 'Not found' });
    return;
  }
  const columns = admitRows('players', 'read', access.roles, rows);
  response.json(projectRow(await enrichRow(rows[0], ['avatar']), columns));
});

async function createPlayerRecord(
  response: RefusalAnswer,
  body: Record<string, unknown>,
  owner: string,
  caller: Caller
): Promise<Record<string, unknown> | undefined> {
  if (!isBody(body)) {
    response.status(400).json({ error: 'Invalid request body' });
    return;
  }
  const typedBody: Body = formattedRow('Player', {
    ...body,
    nickname: body.nickname ?? '',
    fullName: body.fullName ?? '',
    emailAddress: body.emailAddress ?? '',
    avatar: body.avatar ?? null,
    bio: body.bio ?? '',
    joinedDate:
      body.joinedDate === undefined || body.joinedDate === ''
        ? new Date().toISOString().slice(0, 10)
        : body.joinedDate,
    userAccountId: body.userAccountId ?? '',
  });
  const unreadableField = await unreadableReference(
    [typedBody],
    [{ field: 'userAccountId', table: 'user' }],
    caller,
    nothingStored
  );
  if (unreadableField !== null) {
    throw new ConstraintViolationError({
      kind: 'referenceGone',
      type: 'Player',
      field: unreadableField,
    });
  }
  const stagedFiles: StagedFile[] = [];
  if (await unreadableFile(typedBody, ['avatar'], caller, nothingStored)) {
    response.status(404).json({ error: 'File not found' });
    return;
  }
  stageFiles(typedBody, ['avatar'], stagedFiles);
  enforcePlayerConstraints(typedBody);
  const id = crypto.randomUUID();
  const createdRow = await withTransaction<Record<string, unknown>>(
    pool,
    async (client): Promise<Record<string, unknown>> => {
      await storeStagedFiles(client, stagedFiles);
      const inserted = await client.query<Record<string, unknown>>(
        'INSERT INTO "Player" (id, "nickname", "fullName", "emailAddress", "avatar", "bio", "joinedDate", "userAccountId") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, "nickname", "fullName", "emailAddress", "avatar", "bio", "joinedDate", "userAccountId"',
        [
          id,
          typedBody.nickname,
          typedBody.fullName,
          typedBody.emailAddress,
          typedBody.avatar,
          typedBody.bio,
          storedTemporal(typedBody.joinedDate),
          typedBody.userAccountId,
        ]
      );
      await client.query('INSERT INTO "creator_players" ("playerId", "userId") VALUES ($1, $2)', [
        id,
        owner,
      ]);
      return inserted.rows[0];
    }
  );
  return createdRow;
}

playersRouter.post('/', async (request, response) => {
  const access = await requireGrant(request, response, 'players', 'create');
  if (access === null) {
    return;
  }
  const body = request.body as Record<string, unknown>;
  if (typeof body['recordId'] === 'string') {
    const recordValues: unknown[] = [body['recordId']];
    const recordAdmission = hasGrant('players', 'read', access.roles)
      ? admissionClause('players', 'read', access, 'f', recordValues)
      : 'FALSE';
    const readableRecord = await pool.query(
      `SELECT 1 FROM "Player" f${whereClause(['f.id = $1', recordAdmission])}`,
      recordValues
    );
    if (readableRecord.rows.length === 0) {
      response.status(404).json({ error: 'Record not found' });
      return;
    }
    response.status(201).json({ success: true });
    return;
  }
  if (await hiddenCollision('Player', 'players', null, access, body)) {
    const shadow = shadowRecord(body);
    response
      .status(201)
      .json(projectReadableFields(shadow, readColumns('players', access.roles, shadow, false)));
    return;
  }
  const createdRow = await createPlayerRecord(response, body, access.userId ?? '', access);
  if (createdRow === undefined) {
    return;
  }
  const writtenRowColumns = await writtenColumns(pool, 'players', access, createdRow, null);
  response
    .status(201)
    .json(projectReadableFields(await enrichRow(createdRow, ['avatar']), writtenRowColumns));
});

playersRouter.put('/:id', async (request, response) => {
  const access = await requireGrant(request, response, 'players', 'update');
  if (access === null) {
    return;
  }
  const body = request.body as unknown;
  if (!isUpdateBody(body)) {
    response.status(400).json({ error: 'Invalid request body' });
    return;
  }
  formatFields('Player', body);
  const unreadableField = await unreadableReference(
    [body],
    [{ field: 'userAccountId', table: 'user' }],
    access,
    () => storedColumns('Player', request.params.id, ['userAccountId'])
  );
  if (unreadableField !== null) {
    throw new ConstraintViolationError({
      kind: 'referenceGone',
      type: 'Player',
      field: unreadableField,
    });
  }
  const stagedFiles: StagedFile[] = [];
  if (
    await unreadableFile(body, ['avatar'], access, () =>
      storedColumns('Player', request.params.id, ['avatar'])
    )
  ) {
    response.status(404).json({ error: 'File not found' });
    return;
  }
  stageFiles(body, ['avatar'], stagedFiles);
  const outcome = await withTransaction<WriteOutcome>(
    pool,
    async (client): Promise<WriteOutcome> => {
      const values: unknown[] = [request.params.id];
      const owned = ownedColumn('players', 'update', access, 'f', values);
      const admission = admissionClause('players', 'update', access, 'f', values);
      const existing = await client.query<Record<string, unknown>>(
        `SELECT f.id, f."nickname", f."fullName", f."emailAddress", f."avatar", f."bio", f."joinedDate", f."userAccountId", ${owned} FROM "Player" f${whereClause(['f.id = $1', admission])} FOR UPDATE`,
        values
      );
      if (existing.rows.length === 0) {
        return { status: 404, error: 'Not found' };
      }
      const existingRow = existing.rows[0];
      const unwritable = unwritableField(
        'players',
        access.roles,
        existingRow,
        ownedFlag(existingRow),
        body
      );
      if (unwritable !== null) {
        return {
          status: 403,
          error: `Field '${unwritable}' is not writable on 'players' for this role`,
        };
      }
      enforcePlayerConstraints(mergedCandidate(existingRow, body));
      const assigned = assignedColumns([
        ['nickname', body.nickname],
        ['fullName', body.fullName],
        ['emailAddress', body.emailAddress],
        ['avatar', body.avatar],
        ['bio', body.bio],
        ['joinedDate', storedTemporal(body.joinedDate)],
        ['userAccountId', body.userAccountId],
      ]);
      const written = await client.query<Record<string, unknown>>(
        `UPDATE "Player" SET ${assigned.clause} WHERE id = $${assigned.values.length + 1} RETURNING id, "nickname", "fullName", "emailAddress", "avatar", "bio", "joinedDate", "userAccountId"`,
        [...assigned.values, request.params.id]
      );
      await storeStagedFiles(client, stagedFiles);
      return { row: written.rows[0] };
    }
  );
  if (!('row' in outcome)) {
    response.status(outcome.status).json({ error: outcome.error });
    return;
  }
  const writtenRowColumns = await writtenColumns(pool, 'players', access, outcome.row, null);
  response
    .status(200)
    .json(projectReadableFields(await enrichRow(outcome.row, ['avatar']), writtenRowColumns));
});

playersRouter.delete('/:id', async (request, response) => {
  const access = await requireGrant(request, response, 'players', 'delete');
  if (access === null) {
    return;
  }
  const deleteStatus = await withTransaction(
    pool,
    async (client): Promise<'success' | 'not-found'> => {
      const values: unknown[] = [request.params.id];
      const admission = admissionClause('players', 'delete', access, 'f', values);
      const existingItem = await client.query<Record<string, unknown>>(
        `SELECT f.id FROM "Player" f${whereClause(['f.id = $1', admission])} FOR UPDATE`,
        values
      );
      if (existingItem.rows.length === 0) {
        return 'not-found';
      }
      await client.query('DELETE FROM "creator_players" WHERE "playerId" = $1', [
        request.params.id,
      ]);
      const deleted = await client.query('DELETE FROM "Player" WHERE id = $1', [request.params.id]);
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

export const playersViolationsRouter = Router();

playersViolationsRouter.get('/', async (request, response) => {
  const access = await requireGrant(request, response, 'players', 'read');
  if (access === null) {
    return;
  }
  const values: unknown[] = [];
  const owned = ownedColumn('players', 'read', access, 'f', values);
  const admission = admissionClause('players', 'read', access, 'f', values);
  const { rows } = await pool.query<Record<string, unknown>>(
    `SELECT f.*, ${owned} FROM "Player" f${whereClause([admission])}`,
    values
  );
  response.json(
    await collectVisibleRuleViolations(
      pool,
      'Player',
      admitRows('players', 'read', access.roles, rows)
    )
  );
});

const availabilityTable: AvailabilityTable = {
  unique: [['nickname'], ['emailAddress']],
  columns: {
    id: {
      disclosable: false,
    },
    nickname: {
      disclosable: false,
    },
    fullName: {
      disclosable: false,
    },
    emailAddress: {
      disclosable: false,
    },
    avatar: {
      disclosable: false,
    },
    bio: {
      disclosable: false,
    },
    joinedDate: {
      disclosable: false,
    },
    userAccountId: {
      disclosable: false,
    },
  },
};

playersRouter.post('/availability', async (request, response) => {
  const session = await getSession(request);
  const userRoles = session ? await getEffectiveUserRoles(pool, session.user.id) : ['guest'];
  if (!hasGrant('players', 'create', userRoles)) {
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
  const readable = readableFieldSetAllScope('players', userRoles);
  if (!(
    readable === null ||
    readable.has(parsed.field) ||
    isDisclosableField(availabilityTable, parsed.field)
  )) {
    response.status(403).json({ error: 'Field is not disclosable' });
    return;
  }
  const { rows } = await pool.query<Record<string, unknown>>('SELECT * FROM "Player"');
  const taken = takenValues(availabilityTable, rows, parsed);
  if (typeof taken === 'string') {
    response.status(400).json({ error: taken });
    return;
  }
  response.json({ taken });
});
