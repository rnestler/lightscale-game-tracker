import { config } from 'dotenv';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMigrations } from 'better-auth/db/migration';
import { auth } from '../auth.js';
import { pool } from '../db.js';

const directory = dirname(fileURLToPath(import.meta.url));
const environmentFile = resolve(directory, '../../../.env');
config({ path: environmentFile, quiet: true });

const ADMIN_PASSWORD_LINE = /^ADMIN_PASSWORD=.*$/m;

function requireEnvironmentValue(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

interface UserRow {
  id: string;
}

interface DatabaseQueryResult<T> {
  rows: T[];
}

interface SignUpEmailInput {
  body: {
    email: string;
    password: string;
    name: string;
  };
  headers: Headers;
}

type SignUpEmailFunction = (input: SignUpEmailInput) => Promise<unknown>;

function getSignUpEmailFunction(): SignUpEmailFunction {
  const apiRecord = auth.api as unknown as Record<string, unknown>;
  const candidate = apiRecord['signUpEmail'];
  if (typeof candidate !== 'function') {
    throw new Error('Better Auth signUpEmail API is unavailable');
  }
  return candidate as SignUpEmailFunction;
}

async function loadUserByEmail(email: string): Promise<UserRow | null> {
  const queryResult = (await pool.query('SELECT id FROM "user" WHERE email = $1', [
    email,
  ])) as DatabaseQueryResult<UserRow>;
  return queryResult.rows[0] ?? null;
}

async function requireAuthSchema(): Promise<void> {
  const { toBeCreated, toBeAdded } = await getMigrations(auth.options);
  if (toBeCreated.length > 0 || toBeAdded.length > 0) {
    throw new Error(
      'The database lacks the sign-in tables. Run npm run migrate before npm run setup:auth.'
    );
  }
}

async function createAdminUser(email: string, name: string): Promise<UserRow> {
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (password.trim().length === 0) {
    throw new Error(
      `No account exists for ${email} yet and ADMIN_PASSWORD in .env is empty. Set ADMIN_PASSWORD and run npm run setup:auth again.`
    );
  }
  await getSignUpEmailFunction()({ body: { email, password, name }, headers: new Headers() });
  const user = await loadUserByEmail(email);
  if (user === null) {
    throw new Error('Admin user creation failed');
  }
  console.log(`Administrator account created: ${email}`);
  console.log(`Password: ${password}`);
  console.log('Store this password now: It is removed from .env and not shown again.');
  return user;
}

async function existingAdminUser(email: string): Promise<UserRow | null> {
  const user = await loadUserByEmail(email);
  if (user !== null) {
    console.log(`Administrator account ${email} already exists; its password is unchanged.`);
  }
  return user;
}

async function forgetAdminPassword(): Promise<void> {
  const content = await readFile(environmentFile, 'utf-8');
  await writeFile(environmentFile, content.replace(ADMIN_PASSWORD_LINE, 'ADMIN_PASSWORD=""'));
}

async function ensureAdminUser(): Promise<void> {
  const adminEmail = requireEnvironmentValue('ADMIN_EMAIL');
  const adminName = requireEnvironmentValue('ADMIN_NAME');
  const user =
    (await existingAdminUser(adminEmail)) ?? (await createAdminUser(adminEmail, adminName));
  const adminRoleResult = await pool.query('SELECT id FROM "app_role" WHERE id = $1', ['admin']);
  if (adminRoleResult.rows.length !== 1) {
    throw new Error('Role "admin" not found in app_role table');
  }
  await pool.query(
    'INSERT INTO "app_user_role" ("userId", "roleId") VALUES ($1, $2) ON CONFLICT ("userId", "roleId") DO NOTHING',
    [user.id, 'admin']
  );
  await pool.query('UPDATE "user" SET "emailVerified" = true WHERE id = $1', [user.id]);
  await forgetAdminPassword();
}

async function main(): Promise<void> {
  try {
    await requireAuthSchema();
    await ensureAdminUser();
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
