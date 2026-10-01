import { Router } from 'express';
import type { Request, Response } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import { fromNodeHeaders } from 'better-auth/node';
import { pool } from '../db.js';
import {
  getAssignedUserRoles,
  getEffectiveUserRoles,
  loadUserRoles,
  isAdmin,
  hasAppAccess,
  hasManagementAccess,
  hasAnyRole,
  readableFieldSet,
  creatableFieldSet,
  writableFieldSet,
} from '../authorization.js';
import { withTransaction } from '../transaction.js';
import { deleteUserAccount, eraseIdentitySubject, seedForUser } from '../privacy.js';
import { auth, invitationTokenDigest, sendInvitationEmail, COOKIE_PREFIX } from '../auth.js';
import { publicLink } from '../public-address.js';
import { isEmailAddress } from '../validation.js';
import { RESOURCE_PERMISSIONS, TRANSACTION_CALL_ROLES } from '../access-policy.js';
import type { PermissionEntry, PermissionScope } from '../access-policy.js';
import { collectRuleViolations, renderableKinds } from '../rule-violations.js';

const ALL_ROLES = [
  { id: 'admin', name: 'admin', isPredefined: true },
  { id: 'unassigned', name: 'unassigned', isPredefined: true },
  { id: 'guest', name: 'guest', isPredefined: true },
  { id: 'player', name: 'player', isPredefined: false },
  { id: 'scorekeeper', name: 'scorekeeper', isPredefined: false },
];

function grantsRole(permission: PermissionScope | undefined, userRoles: string[]): boolean {
  if (!permission) {
    return false;
  }
  return hasAnyRole(userRoles, [...permission.all, ...permission.own]);
}

interface ResourceGrants {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  call: Record<string, boolean>;
  readFields: string[] | null;
  createFields: string[] | null;
  updateFields: string[] | null;
}

function fieldList(fields: Set<string> | null): string[] | null {
  return fields === null ? null : [...fields];
}

function computePermissions(userRoles: string[]): Record<string, ResourceGrants> {
  const admin = isAdmin(userRoles);
  const callable: Record<string, boolean> = {};
  for (const [transactionName, callRoles] of Object.entries(TRANSACTION_CALL_ROLES)) {
    callable[transactionName] = admin || hasAnyRole(userRoles, callRoles);
  }
  const result: Record<string, ResourceGrants> = {
    '*': {
      read: false,
      create: false,
      update: false,
      delete: false,
      call: callable,
      readFields: null,
      createFields: null,
      updateFields: null,
    },
  };
  for (const [resourceName, perms] of Object.entries(RESOURCE_PERMISSIONS)) {
    if (perms !== undefined) {
      const call: Record<string, boolean> = {};
      for (const transactionName of Object.keys(perms.call ?? {})) {
        call[transactionName] = admin || grantsRole(perms.call?.[transactionName], userRoles);
      }
      const grants = (scope: PermissionScope | undefined): boolean =>
        admin || (perms.individual ? hasAppAccess(userRoles) : grantsRole(scope, userRoles));
      result[resourceName] = {
        read: grants(perms.read),
        create: !perms.uncreatable && grants(perms.create),
        update: grants(perms.update),
        delete: grants(perms.delete),
        call,
        readFields: fieldList(readableFieldSet(resourceName, userRoles)),
        createFields: fieldList(creatableFieldSet(resourceName, userRoles)),
        updateFields: fieldList(writableFieldSet(resourceName, userRoles)),
      };
    }
  }
  return result;
}

export const adminRouter = Router();

function getSession(request: Request): ReturnType<typeof auth.api.getSession> {
  return auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
}

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

async function adminSession(request: Request, response: Response): Promise<Session | null> {
  const session = await getSession(request);
  if (!session) {
    response
      .status(401)
      .json({ error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED' });
    return null;
  }
  const userRoles = await loadUserRoles(pool, session.user.id);
  if (!isAdmin(userRoles)) {
    response
      .status(403)
      .json({ error: 'Unauthorized: Admin role required', code: 'ADMIN_REQUIRED' });
    return null;
  }
  return session;
}

async function requireAdmin(request: Request, response: Response): Promise<boolean> {
  return (await adminSession(request, response)) !== null;
}

function userNotFound(response: Response): void {
  response.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
}

const AUTH_SETTINGS = [
  'requireEmailVerification',
  'allowAccountDeletion',
  'inviteOnly',
  'showStaleData',
  'aiConsentRequired',
] as const;

type AuthSettings = Record<(typeof AUTH_SETTINGS)[number], boolean>;

async function readAuthSettings(): Promise<AuthSettings> {
  const { rows } = await pool.query<Record<string, boolean>>(
    'SELECT "requireEmailVerification", "allowAccountDeletion", "inviteOnly", "showStaleData", "aiConsentRequired" FROM "app_config" LIMIT 1'
  );
  const stored = rows.at(0);
  return {
    requireEmailVerification: stored?.['requireEmailVerification'] ?? false,
    allowAccountDeletion: stored?.['allowAccountDeletion'] ?? true,
    inviteOnly: stored?.['inviteOnly'] ?? false,
    showStaleData: stored?.['showStaleData'] ?? false,
    aiConsentRequired: stored?.['aiConsentRequired'] ?? true,
  };
}

adminRouter.get('/permissions', async (request, response) => {
  const session = await getSession(request);
  let userRoles: string[];
  if (!session) {
    userRoles = ['guest'];
  } else {
    userRoles = await getEffectiveUserRoles(pool, session.user.id);
  }
  const { rows } = await pool.query<{ allowAccountDeletion: boolean }>(
    'SELECT "allowAccountDeletion" FROM "app_config" LIMIT 1'
  );
  const allowAccountDeletion = rows.at(0)?.allowAccountDeletion ?? true;
  response.json({
    permissions: computePermissions(userRoles),
    hasAppAccess: hasAppAccess(userRoles),
    hasManagementAccess: hasManagementAccess(userRoles),
    isAdmin: isAdmin(userRoles),
    allowAccountDeletion,
    roles: userRoles,
  });
});

adminRouter.get('/user/roles', async (request, response) => {
  const session = await getSession(request);
  if (!session) {
    response.json({ roles: ['guest'] });
    return;
  }
  const userRoles = await getAssignedUserRoles(pool, session.user.id);
  response.json({ roles: userRoles });
});

adminRouter.get('/users', async (request, response) => {
  const session = await getSession(request);
  if (!session) {
    response
      .status(401)
      .json({ error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED' });
    return;
  }
  const userRoles = await getEffectiveUserRoles(pool, session.user.id);
  if (!hasAppAccess(userRoles)) {
    response
      .status(403)
      .json({ error: 'Unauthorized: App access required', code: 'APP_ACCESS_REQUIRED' });
    return;
  }
  const exposesEmail = isAdmin(userRoles);
  const { rows } = await pool.query<{ id: string; name: string | null; email: string | null }>(
    'SELECT id, name, email FROM "user" ORDER BY "createdAt" ASC'
  );
  const users = rows.map((row) => ({
    id: row.id,
    name: row.name ?? '',
    email: exposesEmail ? (row.email ?? '') : '',
  }));
  response.json({ users });
});

adminRouter.get('/admin/users', async (request, response) => {
  if (!(await requireAdmin(request, response))) {
    return;
  }
  const { rows } = await pool.query(
    'SELECT u.id, u.email, u.name, u."emailVerified", u."createdAt", COALESCE(array_agg(ur."roleId") FILTER (WHERE ur."roleId" IS NOT NULL), ARRAY[]::TEXT[]) AS roles FROM "user" u LEFT JOIN "app_user_role" ur ON ur."userId" = u.id GROUP BY u.id, u.email, u.name, u."emailVerified", u."createdAt" ORDER BY u."createdAt" ASC'
  );
  const users = rows.map((row: Record<string, unknown>) => ({
    id: row['id'],
    email: row['email'],
    name: row['name'],
    emailVerified: row['emailVerified'],
    createdAt: row['createdAt'],
    roles: Array.isArray(row['roles'])
      ? row['roles'].filter((role): role is string => typeof role === 'string')
      : [],
  }));
  response.json({ users });
});

adminRouter.post('/admin/users/:userId/roles/:roleId', async (request, response) => {
  if (!(await requireAdmin(request, response))) {
    return;
  }
  const { userId, roleId } = request.params;
  const validRole = ALL_ROLES.find((r) => r.id === roleId);
  if (!validRole) {
    response.status(404).json({ error: 'Role not found', code: 'ROLE_NOT_FOUND' });
    return;
  }
  const userFound = await withTransaction(pool, async (client): Promise<boolean> => {
    const userResult = await client.query('SELECT id FROM "user" WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return false;
    }
    await client.query(
      'INSERT INTO "app_user_role" ("userId", "roleId") VALUES ($1, $2) ON CONFLICT ("userId", "roleId") DO NOTHING',
      [userId, roleId]
    );
    return true;
  });
  if (!userFound) {
    userNotFound(response);
    return;
  }
  response.json({ success: true });
});

adminRouter.delete('/admin/users/:userId/roles/:roleId', async (request, response) => {
  const session = await adminSession(request, response);
  if (session === null) {
    return;
  }
  const { userId, roleId } = request.params;
  if (userId === session.user.id && roleId === 'admin') {
    response
      .status(400)
      .json({ error: 'Cannot remove your own admin role', code: 'CANNOT_REMOVE_OWN_ADMIN_ROLE' });
    return;
  }
  const userFound = await withTransaction(pool, async (client): Promise<boolean> => {
    const userResult = await client.query('SELECT id FROM "user" WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return false;
    }
    await client.query('DELETE FROM "app_user_role" WHERE "userId" = $1 AND "roleId" = $2', [
      userId,
      roleId,
    ]);
    return true;
  });
  if (!userFound) {
    userNotFound(response);
    return;
  }
  response.json({ success: true });
});

adminRouter.delete('/admin/users/:userId', async (request, response) => {
  const session = await adminSession(request, response);
  if (session === null) {
    return;
  }
  const { userId } = request.params;
  if (userId === session.user.id) {
    response.status(400).json({ error: 'Cannot delete yourself', code: 'CANNOT_DELETE_SELF' });
    return;
  }
  const userDeleted = await withTransaction(pool, async (client): Promise<boolean> => {
    const existingUser = await client.query('SELECT id FROM "user" WHERE id = $1', [userId]);
    if (existingUser.rowCount !== 1) {
      return false;
    }
    await client.query('DELETE FROM "account" WHERE "userId" = $1', [userId]);
    await client.query('DELETE FROM "session" WHERE "userId" = $1', [userId]);
    await client.query('DELETE FROM "app_user_role" WHERE "userId" = $1', [userId]);
    const deletedUser = await client.query('DELETE FROM "user" WHERE id = $1', [userId]);
    return deletedUser.rowCount === 1;
  });
  if (!userDeleted) {
    userNotFound(response);
    return;
  }
  response.json({ success: true });
});

adminRouter.delete('/account', async (request, response) => {
  const session = await getSession(request);
  if (!session) {
    response
      .status(401)
      .json({ error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED' });
    return;
  }
  const { rows } = await pool.query<{ allowAccountDeletion: boolean }>(
    'SELECT "allowAccountDeletion" FROM "app_config" LIMIT 1'
  );
  if (!(rows.at(0)?.allowAccountDeletion ?? true)) {
    response
      .status(403)
      .json({ error: 'Account deletion is disabled', code: 'ACCOUNT_DELETION_DISABLED' });
    return;
  }
  const userRoles = await loadUserRoles(pool, session.user.id);
  if (isAdmin(userRoles)) {
    response.status(403).json({
      error: 'Admins cannot delete their own account',
      code: 'ADMIN_CANNOT_DELETE_ACCOUNT',
    });
    return;
  }
  if (Date.now() - new Date(session.session.createdAt).getTime() > 600000) {
    response
      .status(403)
      .json({ error: 'Sign in again to delete your account', code: 'RECENT_SIGN_IN_REQUIRED' });
    return;
  }
  const userId = session.user.id;
  await withTransaction<void>(pool, async (client): Promise<void> => {
    await eraseIdentitySubject(client, await seedForUser(client, userId), new Map(), 'delete');
    await deleteUserAccount(client, userId);
  });
  response.json({ success: true });
});

adminRouter.get('/admin/roles', async (request, response) => {
  if (!(await requireAdmin(request, response))) {
    return;
  }
  response.json({ roles: ALL_ROLES });
});

type GrantScope = 'all' | 'own' | null;
interface PermissionRow {
  read: GrantScope;
  create: GrantScope;
  update: GrantScope;
  delete: GrantScope;
}

function scopeForRole(
  role: string,
  entry: PermissionEntry,
  operation: 'read' | 'create' | 'update' | 'delete'
): GrantScope {
  if (operation === 'create' && entry.uncreatable) {
    return null;
  }
  if (entry.individual) {
    return role === 'guest' || role === 'unassigned' ? null : 'own';
  }
  if (role === 'admin') {
    return 'all';
  }
  const scopes = entry[operation];
  if (!scopes) {
    return null;
  }
  if (scopes.all.includes(role)) {
    return 'all';
  }
  if (scopes.own.includes(role)) {
    return 'own';
  }
  return null;
}

adminRouter.get('/admin/roles/permissions', async (request, response) => {
  if (!(await requireAdmin(request, response))) {
    return;
  }
  const roles = ALL_ROLES.map((role) => role.name);
  const paths = Object.keys(RESOURCE_PERMISSIONS);
  const matrix: Record<string, Record<string, PermissionRow>> = {};
  for (const role of roles) {
    const rowsForRole: Record<string, PermissionRow> = {};
    for (const path of paths) {
      const entry = RESOURCE_PERMISSIONS[path];
      if (entry !== undefined) {
        rowsForRole[path] = {
          read: scopeForRole(role, entry, 'read'),
          create: scopeForRole(role, entry, 'create'),
          update: scopeForRole(role, entry, 'update'),
          delete: scopeForRole(role, entry, 'delete'),
        };
      }
    }
    matrix[role] = rowsForRole;
  }
  response.json({ roles, paths, matrix });
});

adminRouter.get('/admin/auth-settings', async (request, response) => {
  if (!(await requireAdmin(request, response))) {
    return;
  }
  response.json(await readAuthSettings());
});

adminRouter.put('/admin/auth-settings', async (request, response) => {
  if (!(await requireAdmin(request, response))) {
    return;
  }
  const body = request.body as Record<string, unknown>;
  for (const setting of AUTH_SETTINGS) {
    const value = body[setting];
    if (value !== undefined) {
      if (typeof value !== 'boolean') {
        response.status(400).json({ error: `${setting} must be boolean`, code: 'INVALID_REQUEST' });
        return;
      }
      await pool.query(`UPDATE "app_config" SET "${setting}" = $1`, [value]);
    }
  }
  response.json(await readAuthSettings());
});

adminRouter.get('/ai-consent/policy', async (_request, response) => {
  const settings = await readAuthSettings();
  response.json({ required: settings.aiConsentRequired });
});

function clearedSessionCookies(): string[] {
  const name = `${COOKIE_PREFIX}.session_token`;
  return [
    `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
    `__Secure-${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None`,
  ];
}

adminRouter.delete('/session-cookie', (_request, response) => {
  response.setHeader('Set-Cookie', clearedSessionCookies());
  response.json({ success: true });
});

const AUTOMATION_PROMPTS = {};

adminRouter.get('/automation-prompts', async (request, response) => {
  if (!(await requireAdmin(request, response))) {
    return;
  }
  response.json({ prompts: AUTOMATION_PROMPTS });
});

adminRouter.get('/admin/rule-violations', async (request, response) => {
  if (!(await requireAdmin(request, response))) {
    return;
  }
  const kinds = renderableKinds(request.query['kinds']);
  response.json({ groups: await collectRuleViolations(pool, kinds) });
});

function invitationLink(token: string): string {
  return publicLink(`/register?invite=${encodeURIComponent(token)}`);
}

adminRouter.get('/signup-mode', async (request, response) => {
  const { rows } = await pool.query<{ inviteOnly: boolean }>(
    'SELECT "inviteOnly" FROM "app_config" LIMIT 1'
  );
  response.json({ inviteOnly: rows.at(0)?.inviteOnly ?? false });
});

adminRouter.get('/invitation/:token', async (request, response) => {
  const { token } = request.params;
  const { rows } = await pool.query<{ email: string }>(
    'SELECT email FROM "app_invitation" WHERE token = $1 AND "expiresAt" > NOW() LIMIT 1',
    [invitationTokenDigest(token)]
  );
  const row = rows.at(0);
  if (row === undefined) {
    response.json({ valid: false, email: '' });
    return;
  }
  response.json({ valid: true, email: row.email });
});

adminRouter.post('/admin/users/invite', async (request, response) => {
  const session = await adminSession(request, response);
  if (session === null) {
    return;
  }
  const { email, roleId } = request.body as { email?: string; roleId?: string };
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!isEmailAddress(normalizedEmail)) {
    response.status(400).json({ error: 'A valid email is required', code: 'EMAIL_REQUIRED' });
    return;
  }
  const role = typeof roleId === 'string' ? roleId : '';
  if (role !== '' && !ALL_ROLES.some((r) => r.id === role)) {
    response.status(404).json({ error: 'Role not found', code: 'ROLE_NOT_FOUND' });
    return;
  }
  const existingUser = await pool.query('SELECT id FROM "user" WHERE LOWER(email) = $1', [
    normalizedEmail,
  ]);
  if (existingUser.rows.length > 0) {
    response
      .status(409)
      .json({ error: 'A user with this email already exists', code: 'USER_ALREADY_EXISTS' });
    return;
  }
  const existingInvite = await pool.query(
    'SELECT id FROM "app_invitation" WHERE LOWER(email) = $1 AND "expiresAt" > NOW()',
    [normalizedEmail]
  );
  if (existingInvite.rows.length > 0) {
    response
      .status(409)
      .json({ error: 'An invitation for this email already exists', code: 'INVITATION_EXISTS' });
    return;
  }
  const id = randomUUID();
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await pool.query(
    'INSERT INTO "app_invitation" ("id", "email", "roleId", "token", "expiresAt", "invitedBy") VALUES ($1, $2, $3, $4, $5, $6)',
    [id, normalizedEmail, role, invitationTokenDigest(token), expiresAt, session.user.id]
  );
  await sendInvitationEmail(normalizedEmail, invitationLink(token));
  response.json({
    success: true,
    invitation: { id, email: normalizedEmail, roleId: role, expiresAt },
  });
});

adminRouter.get('/admin/invitations', async (request, response) => {
  if (!(await requireAdmin(request, response))) {
    return;
  }
  const { rows } = await pool.query<{
    id: string;
    email: string;
    roleId: string;
    createdAt: string;
    expiresAt: string;
  }>(
    'SELECT id, email, "roleId", "createdAt", "expiresAt" FROM "app_invitation" ORDER BY "createdAt" DESC'
  );
  response.json({ invitations: rows });
});

adminRouter.delete('/admin/invitations/:id', async (request, response) => {
  if (!(await requireAdmin(request, response))) {
    return;
  }
  const deleted = await pool.query('DELETE FROM "app_invitation" WHERE id = $1', [
    request.params.id,
  ]);
  if (deleted.rowCount !== 1) {
    response.status(404).json({ error: 'Invitation not found', code: 'INVITATION_NOT_FOUND' });
    return;
  }
  response.json({ success: true });
});

adminRouter.post('/admin/invitations/:id/resend', async (request, response) => {
  if (!(await requireAdmin(request, response))) {
    return;
  }
  const { rows } = await pool.query<{ email: string }>(
    'SELECT email FROM "app_invitation" WHERE id = $1 LIMIT 1',
    [request.params.id]
  );
  const row = rows.at(0);
  if (row === undefined) {
    response.status(404).json({ error: 'Invitation not found', code: 'INVITATION_NOT_FOUND' });
    return;
  }
  const token = randomBytes(32).toString('base64url');
  await pool.query('UPDATE "app_invitation" SET token = $1 WHERE id = $2', [
    invitationTokenDigest(token),
    request.params.id,
  ]);
  await sendInvitationEmail(row.email, invitationLink(token));
  response.json({ success: true });
});

const DECLARED_TABLES: Partial<Record<string, string[]>> = {
  GameType: ['id', 'name', 'category', 'rulesVariant', 'defaultRating', 'description'],
  Player: [
    'id',
    'nickname',
    'fullName',
    'emailAddress',
    'avatar',
    'bio',
    'joinedDate',
    'userAccountId',
  ],
  LeaderboardEntry: [
    'id',
    'playerId',
    'gameId',
    'rating',
    'matchesPlayed',
    'wins',
    'losses',
    'draws',
    'lastPlayedAt',
    'playerId$reference',
    'gameId$reference',
  ],
  Match: [
    'id',
    'gameId',
    'playerOneId',
    'playerTwoId',
    'scheduledAt',
    'status',
    'outcome',
    'playerOneScore',
    'playerTwoScore',
    'playerOneRatingDelta',
    'playerTwoRatingDelta',
    'notes',
    'recordedById',
    'createdAt',
    'gameId$reference',
    'playerOneId$reference',
    'playerTwoId$reference',
  ],
};

const INFRASTRUCTURE_TABLES = new Set<string>([
  '$FILES',
  '_outbox',
  '_schedule',
  '_predicate',
  '_stagedCheckouts',
  'app_role',
  'app_user_role',
  'app_config',
  'app_invitation',
  'schema_migrations',
  'schema_shape',
  'user',
  'session',
  'account',
  'verification',
  'twoFactor',
  'passkey',
  'app_user_profile',
  'app_user_profile_owner',
  'app_privacy_inquiry',
  'creator_games',
  'creator_players',
  'creator_matches',
  'creator_leaderboards',
]);

const STALE_BACKUP_PREFIX = '$OLD_';

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function isKnownStaleTable(tableName: string): boolean {
  return tableName.startsWith('_') || INFRASTRUCTURE_TABLES.has(tableName);
}

function staleLabel(column: string): string {
  return column.startsWith(STALE_BACKUP_PREFIX) ? column.slice(STALE_BACKUP_PREFIX.length) : column;
}

function stringifyStaleValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return JSON.stringify(value);
}

async function listStaleSchemaTables(): Promise<string[]> {
  const { rows } = await pool.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'"
  );
  return rows.map((row) => row.table_name);
}

async function listStaleTableColumns(tableName: string): Promise<string[]> {
  const { rows } = await pool.query<{ column_name: string }>(
    'SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1',
    [tableName]
  );
  return rows.map((row) => row.column_name);
}

function pickStaleKeyColumn(tableName: string, dbColumns: string[]): string {
  if (DECLARED_TABLES[tableName] !== undefined) {
    return 'id';
  }
  return dbColumns.includes('id') ? 'id' : (dbColumns.at(0) ?? 'id');
}

async function staleColumnsOf(
  tableName: string
): Promise<Array<{ column: string; label: string }>> {
  const declared = new Set(DECLARED_TABLES[tableName] ?? []);
  const dbColumns = await listStaleTableColumns(tableName);
  return dbColumns
    .filter((column) => !declared.has(column))
    .map((column) => ({ column, label: staleLabel(column) }));
}

async function countStaleRows(tableName: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${quoteIdentifier(tableName)}`
  );
  return Number(rows.at(0)?.count ?? '0');
}

adminRouter.get('/admin/stale-data', async (request, response) => {
  if (!(await requireAdmin(request, response))) {
    return;
  }
  const dbTables = await listStaleSchemaTables();
  const tables: Array<{
    table: string;
    label: string;
    orphan: boolean;
    columns: Array<{ column: string; label: string }>;
    rowCount: number;
  }> = [];
  for (const tableName of dbTables) {
    if (isKnownStaleTable(tableName)) {
      continue;
    }
    if (DECLARED_TABLES[tableName] !== undefined) {
      const columns = await staleColumnsOf(tableName);
      if (columns.length > 0) {
        tables.push({
          table: tableName,
          label: tableName,
          orphan: false,
          columns,
          rowCount: await countStaleRows(tableName),
        });
      }
    } else {
      const rowCount = await countStaleRows(tableName);
      if (rowCount > 0) {
        tables.push({ table: tableName, label: tableName, orphan: true, columns: [], rowCount });
      }
    }
  }
  response.json({ tables });
});

adminRouter.get('/admin/stale-data/:table', async (request, response) => {
  if (!(await requireAdmin(request, response))) {
    return;
  }
  const { table } = request.params;
  const dbTables = await listStaleSchemaTables();
  if (!dbTables.includes(table) || isKnownStaleTable(table)) {
    response.json({ columns: [], rows: [] });
    return;
  }
  const dbColumns = await listStaleTableColumns(table);
  const keyColumn = pickStaleKeyColumn(table, dbColumns);
  let columns: Array<{ column: string; label: string }>;
  if (DECLARED_TABLES[table] !== undefined) {
    columns = await staleColumnsOf(table);
  } else {
    columns = dbColumns
      .filter((column) => column !== keyColumn)
      .map((column) => ({ column, label: staleLabel(column) }));
  }
  if (columns.length === 0) {
    response.json({ columns: [], rows: [] });
    return;
  }
  const selected = [keyColumn, ...columns.map(({ column }) => column)]
    .map(quoteIdentifier)
    .join(', ');
  const { rows: rawRows } = await pool.query<Record<string, unknown>>(
    `SELECT ${selected} FROM ${quoteIdentifier(table)}`
  );
  const rows = rawRows.map((record) => {
    const values: Record<string, string> = {};
    for (const { column } of columns) {
      values[column] = stringifyStaleValue(record[column]);
    }
    return { id: stringifyStaleValue(record[keyColumn]), values };
  });
  response.json({ columns, rows });
});

adminRouter.get('/admin/stale-data/:table/record/:id', async (request, response) => {
  if (!(await requireAdmin(request, response))) {
    return;
  }
  const { table, id } = request.params;
  const dbTables = await listStaleSchemaTables();
  if (!dbTables.includes(table) || isKnownStaleTable(table)) {
    response.json({ columns: [] });
    return;
  }
  const dbColumns = await listStaleTableColumns(table);
  const keyColumn = pickStaleKeyColumn(table, dbColumns);
  const dataColumns = dbColumns.filter((column) => column !== keyColumn);
  if (dataColumns.length === 0) {
    response.json({ columns: [] });
    return;
  }
  const selected = dataColumns.map(quoteIdentifier).join(', ');
  const { rows } = await pool.query<Record<string, unknown>>(
    `SELECT ${selected} FROM ${quoteIdentifier(table)} WHERE ${quoteIdentifier(keyColumn)} = $1`,
    [id]
  );
  const row = rows.at(0);
  if (row === undefined) {
    response.json({ columns: [] });
    return;
  }
  const declared = new Set(DECLARED_TABLES[table] ?? []);
  response.json({
    columns: dataColumns.map((column) => ({
      column,
      label: staleLabel(column),
      value: stringifyStaleValue(row[column]),
      stale: !declared.has(column),
    })),
  });
});

adminRouter.post('/admin/stale-data/clear', async (request, response) => {
  if (!(await requireAdmin(request, response))) {
    return;
  }
  const { table, column } = request.body as { table?: string; column?: string };
  if (typeof table !== 'string' || table === '') {
    response.status(400).json({ error: 'table is required' });
    return;
  }
  const dbTables = await listStaleSchemaTables();
  if (!dbTables.includes(table) || isKnownStaleTable(table)) {
    response.status(404).json({ error: 'Stale data not found' });
    return;
  }
  let cleared: boolean;
  if (typeof column === 'string' && column !== '') {
    const staleColumns = await staleColumnsOf(table);
    if (staleColumns.some((candidate) => candidate.column === column)) {
      await pool.query(`UPDATE ${quoteIdentifier(table)} SET ${quoteIdentifier(column)} = NULL`);
      cleared = true;
    } else {
      cleared = false;
    }
  } else if (DECLARED_TABLES[table] === undefined) {
    await pool.query(`DELETE FROM ${quoteIdentifier(table)}`);
    cleared = true;
  } else {
    cleared = false;
  }
  if (!cleared) {
    response.status(404).json({ error: 'Stale data not found' });
    return;
  }
  response.json({ success: true });
});

adminRouter.post('/admin/stale-data/delete-record', async (request, response) => {
  if (!(await requireAdmin(request, response))) {
    return;
  }
  const { table, id } = request.body as { table?: string; id?: string };
  if (typeof table !== 'string' || table === '') {
    response.status(400).json({ error: 'table is required' });
    return;
  }
  if (typeof id !== 'string' || id === '') {
    response.status(400).json({ error: 'id is required' });
    return;
  }
  const dbTables = await listStaleSchemaTables();
  if (!dbTables.includes(table) || isKnownStaleTable(table)) {
    response.status(404).json({ error: 'Stale data not found' });
    return;
  }
  const dbColumns = await listStaleTableColumns(table);
  const keyColumn = pickStaleKeyColumn(table, dbColumns);
  let deleted: boolean;
  if (DECLARED_TABLES[table] === undefined) {
    const result = await pool.query(
      `DELETE FROM ${quoteIdentifier(table)} WHERE ${quoteIdentifier(keyColumn)} = $1`,
      [id]
    );
    deleted = result.rowCount === 1;
  } else {
    const staleColumns = await staleColumnsOf(table);
    if (staleColumns.length === 0) {
      deleted = false;
    } else {
      const assignments = staleColumns
        .map((column) => `${quoteIdentifier(column.column)} = NULL`)
        .join(', ');
      const result = await pool.query(
        `UPDATE ${quoteIdentifier(table)} SET ${assignments} WHERE ${quoteIdentifier(keyColumn)} = $1`,
        [id]
      );
      deleted = result.rowCount === 1;
    }
  }
  if (!deleted) {
    response.status(404).json({ error: 'Stale data not found' });
    return;
  }
  response.json({ success: true });
});
