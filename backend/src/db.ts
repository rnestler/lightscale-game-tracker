import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, types } from 'pg';
import type { PoolClient } from 'pg';

export type Queryable = Pick<PoolClient, 'query'>;

const directory = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(directory, '../../.env'), quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
  throw new Error('Missing required environment variable: DATABASE_URL');
}

type TypeOid = (typeof types.builtins)[keyof typeof types.builtins];

const BIGINT_ARRAY_TYPE = 1016 as TypeOid;
const DATE_ARRAY_TYPE = 1182 as TypeOid;
const NUMERIC_ARRAY_TYPE = 1231 as TypeOid;

function calendarDay(value: string): string {
  return value;
}

function calendarDays(value: string): string[] {
  const elements = value.slice(1, -1);
  return elements === '' ? [] : elements.split(',');
}

function safeInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`BIGINT value "${value}" exceeds the safe integer range`);
  }
  return parsed;
}

function integerArray(value: string): number[] {
  const elements = value.slice(1, -1);
  return elements === '' ? [] : elements.split(',').map(safeInteger);
}

function finiteNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`NUMERIC value "${value}" is not a finite number`);
  }
  return parsed;
}

function numericArray(value: string): number[] {
  const elements = value.slice(1, -1);
  return elements === '' ? [] : elements.split(',').map(finiteNumber);
}

types.setTypeParser(types.builtins.INT8, safeInteger);
types.setTypeParser(BIGINT_ARRAY_TYPE, integerArray);
types.setTypeParser(types.builtins.DATE, calendarDay);
types.setTypeParser(DATE_ARRAY_TYPE, calendarDays);
types.setTypeParser(types.builtins.NUMERIC, finiteNumber);
types.setTypeParser(NUMERIC_ARRAY_TYPE, numericArray);

export const pool = new Pool({
  connectionString: databaseUrl,
});
