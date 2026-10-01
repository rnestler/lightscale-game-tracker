import { readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const MIGRATIONS_FOLDER = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../database/migrations'
);
const PACKAGE_SHAPE = 3;
const MIGRATE_INSTRUCTION = 'Run npm run migrate, then start the software again.';

function releaseNumber(version: string): number {
  const number = Number.parseInt(version.split('__')[0] ?? '', 10);
  if (Number.isNaN(number)) {
    throw new Error(`Migration ${version} has no numeric version prefix`);
  }
  return number;
}

function highestRelease(versions: string[]): number {
  let highest = 0;
  for (const version of versions) {
    highest = Math.max(highest, releaseNumber(version));
  }
  return highest;
}

async function packageRelease(): Promise<number> {
  const entries = await readdir(MIGRATIONS_FOLDER, { withFileTypes: true });
  return highestRelease(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));
}

async function databaseRelease(): Promise<{ release: number; shapes: number[] }> {
  const tables = await pool.query<{ tracked: boolean }>(
    "SELECT to_regclass('schema_migrations') IS NOT NULL AND to_regclass('schema_shape') IS NOT NULL AS tracked"
  );
  if (!tables.rows.some((row) => row.tracked)) {
    return { release: 0, shapes: [] };
  }
  const versions = await pool.query<{ version: string }>('SELECT version FROM schema_migrations');
  const shapes = await pool.query<{ shape: number }>('SELECT shape FROM schema_shape');
  return {
    release: highestRelease(versions.rows.map((row) => row.version)),
    shapes: shapes.rows.map((row) => row.shape),
  };
}

export async function requireMigratedDatabase(): Promise<void> {
  const expected = await packageRelease();
  const { release, shapes } = await databaseRelease();
  if (release !== expected) {
    throw new Error(
      `The database is at release ${release}, but this software is release ${expected}. ${MIGRATE_INSTRUCTION}`
    );
  }
  if (shapes.length !== 1 || shapes[0] !== PACKAGE_SHAPE) {
    throw new Error(
      `The database layout has not been verified by this software. ${MIGRATE_INSTRUCTION}`
    );
  }
}
