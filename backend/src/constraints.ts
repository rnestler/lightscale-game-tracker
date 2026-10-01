import type { Queryable } from './db.js';
import type { Caller } from './authorization.js';
import { unreadableFile } from './file-access.js';
import { mergedCandidate } from './record-writes.js';
import { isEmailAddress } from './validation.js';
import { intervalInterval, isIntervalValue, type TemporalKind } from './utils/temporal.js';

export type StringFormat = 'email' | 'phone' | 'url' | 'country' | 'timezone';

export type Refusal =
  | { kind: 'required'; type: string; field: string; mustBeTrue: boolean }
  | { kind: 'format'; type: string; field: string; format: StringFormat }
  | { kind: 'rule'; type: string; fields: string[] }
  | { kind: 'exclusive'; type: string; partition: string[]; interval: string[] }
  | { kind: 'capacity'; type: string; limit: number }
  | { kind: 'referenceGone'; type: string; field: string }
  | { kind: 'stated'; message: string };

function validTimeZone(value: string): boolean {
  if (value.startsWith('+') || value.startsWith('-')) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch (error) {
    if (error instanceof RangeError) {
      return false;
    }
    throw error;
  }
}

const FORMATS: Record<StringFormat, { matches: (value: string) => boolean; description: string }> =
  {
    email: { matches: isEmailAddress, description: 'an email address' },
    phone: {
      matches: (value) => /^\+?[\d\s\-().]{6,}$/.test(value),
      description: 'a phone number',
    },
    url: {
      matches: (value) => /^https?:\/\/[^\s]+\.[^\s]+$/.test(value),
      description: 'a web address',
    },
    country: {
      matches: (value) => /^[A-Za-z]{2}$/.test(value),
      description: 'a two-letter country code',
    },
    timezone: { matches: validTimeZone, description: 'an IANA time zone' },
  };

function quoteName(name: string): string {
  return `'${name}'`;
}

function refusalSentence(refusal: Refusal): string {
  switch (refusal.kind) {
    case 'stated':
      return refusal.message;
    case 'required':
      return refusal.mustBeTrue
        ? `'${refusal.field}' must be true on '${refusal.type}'; required boolean fields must be checked`
        : `'${refusal.field}' is required on '${refusal.type}'`;
    case 'format':
      return `'${refusal.field}' on '${refusal.type}' expects ${FORMATS[refusal.format].description}`;
    case 'rule': {
      const named = refusal.fields.map(quoteName).join(', ');
      return refusal.fields.length === 1
        ? `'${refusal.type}' cannot be saved: the value in ${named} is not allowed here`
        : `'${refusal.type}' cannot be saved: the values in ${named} are not allowed together`;
    }
    case 'exclusive':
      return `A record with this ${refusal.partition.join(', ')} already has an overlapping ${refusal.interval.join('/')} on '${refusal.type}'`;
    case 'capacity':
      return `'${refusal.type}' has reached its capacity of ${refusal.limit}`;
    case 'referenceGone':
      return `'${refusal.field}' on '${refusal.type}' points to a record that no longer exists`;
    default: {
      const unreachable: never = refusal;
      throw new Error(`Unhandled constraint refusal: ${JSON.stringify(unreachable)}`);
    }
  }
}

export class ConstraintViolationError extends Error {
  public readonly refusal: Refusal;

  constructor(refusal: Refusal) {
    super(refusalSentence(refusal));
    this.name = 'ConstraintViolationError';
    this.refusal = refusal;
  }
}

function formattedText(type: string, field: string, format: StringFormat, value: string): string {
  const trimmed = value.trim();
  const normalized = format === 'email' || format === 'country' ? trimmed.toLowerCase() : trimmed;
  if (normalized !== '' && !FORMATS[format].matches(normalized)) {
    throw new ConstraintViolationError({ kind: 'format', type, field, format });
  }
  return normalized;
}

function distinctElements(values: unknown[]): unknown[] {
  const seen = new Set<string>();
  const distinct: unknown[] = [];
  for (const value of values) {
    const key = JSON.stringify(value);
    if (!seen.has(key)) {
      seen.add(key);
      distinct.push(value);
    }
  }
  return distinct;
}

function formattedElements(
  type: string,
  field: string,
  format: StringFormat,
  values: unknown[]
): unknown[] {
  const formatted: unknown[] = [];
  for (const value of values) {
    formatted.push(typeof value === 'string' ? formattedText(type, field, format, value) : value);
  }
  return formatted;
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'boolean') {
    return !value;
  }
  return typeof value === 'string' && value.trim().length === 0;
}

function requireValue(
  candidate: Record<string, unknown>,
  field: string,
  table: string,
  mustBeTrue: boolean
): void {
  if (isEmptyValue(candidate[field])) {
    throw new ConstraintViolationError({ kind: 'required', type: table, field, mustBeTrue });
  }
}

type Row = Record<string, unknown>;

interface RecordRules {
  readonly formats: Readonly<Record<string, StringFormat>>;
  readonly sets: readonly string[];
  readonly documents: readonly string[];
  readonly intervals: Readonly<Record<string, { kind: TemporalKind; depth: number }>>;
  readonly enforce:
    | ((
        client: Queryable,
        candidate: Row,
        previous: Row | null,
        currentId: string | null,
        callerId: string | null
      ) => Promise<void> | void)
    | null;
}

export function enforceGameTypeConstraints(candidate: Record<string, unknown>): void {
  requireValue(candidate, 'name', 'GameType', false);
  requireValue(candidate, 'category', 'GameType', false);
}

export function enforcePlayerConstraints(candidate: Record<string, unknown>): void {
  requireValue(candidate, 'nickname', 'Player', false);
  requireValue(candidate, 'fullName', 'Player', false);
  requireValue(candidate, 'emailAddress', 'Player', false);
}

export function enforceLeaderboardEntryConstraints(candidate: Record<string, unknown>): void {
  requireValue(candidate, 'playerId', 'LeaderboardEntry', false);
  requireValue(candidate, 'gameId', 'LeaderboardEntry', false);
}

export function enforceMatchConstraints(candidate: Record<string, unknown>): void {
  requireValue(candidate, 'gameId', 'Match', false);
  requireValue(candidate, 'playerOneId', 'Match', false);
  requireValue(candidate, 'playerTwoId', 'Match', false);
  requireValue(candidate, 'scheduledAt', 'Match', false);
}

const RECORD_RULES: Readonly<Record<string, RecordRules | undefined>> = {
  GameType: {
    formats: {},
    sets: [],
    documents: [],
    intervals: {},
    enforce: (
      _client: Queryable,
      candidate: Row,
      _previous: Row | null,
      _currentId: string | null,
      _callerId: string | null
    ): void => {
      enforceGameTypeConstraints(candidate);
    },
  },
  Player: {
    formats: { emailAddress: 'email' },
    sets: [],
    documents: [],
    intervals: {},
    enforce: (
      _client: Queryable,
      candidate: Row,
      _previous: Row | null,
      _currentId: string | null,
      _callerId: string | null
    ): void => {
      enforcePlayerConstraints(candidate);
    },
  },
  LeaderboardEntry: {
    formats: {},
    sets: [],
    documents: [],
    intervals: {},
    enforce: (
      _client: Queryable,
      candidate: Row,
      _previous: Row | null,
      _currentId: string | null,
      _callerId: string | null
    ): void => {
      enforceLeaderboardEntryConstraints(candidate);
    },
  },
  Match: {
    formats: {},
    sets: [],
    documents: [],
    intervals: {},
    enforce: (
      _client: Queryable,
      candidate: Row,
      _previous: Row | null,
      _currentId: string | null,
      _callerId: string | null
    ): void => {
      enforceMatchConstraints(candidate);
    },
  },
};

function rulesOf(type: string): RecordRules | null {
  return RECORD_RULES[type] ?? null;
}

function intervalField(
  type: string,
  field: string,
  kind: TemporalKind,
  depth: number,
  value: unknown,
  allowBlank: boolean
): unknown {
  if (allowBlank && depth === 0 && value === '') {
    return '';
  }
  if (depth > 0 && Array.isArray(value)) {
    return value.map((item) => intervalField(type, field, kind, depth - 1, item, false));
  }
  if (depth === 0 && isIntervalValue(kind, value)) {
    return intervalInterval(kind, value.start, value.end);
  }
  throw new ConstraintViolationError({
    kind: 'stated',
    message: `'${field}' on '${type}' requires ordered ${kind} interval endpoints`,
  });
}

function storedValue(type: string, field: string, value: unknown): unknown {
  return rulesOf(type)?.intervals[field]?.depth === 0 ? JSON.stringify(value) : value;
}

export function formattedRow<T extends Row>(type: string, row: T): T {
  const rules = rulesOf(type);
  const formatted: Row = { ...row };
  for (const [field, interval] of Object.entries(rules?.intervals ?? {})) {
    if (row[field] !== undefined) {
      formatted[field] = intervalField(
        type,
        field,
        interval.kind,
        interval.depth,
        row[field],
        true
      );
    }
  }
  for (const [field, format] of Object.entries(rules?.formats ?? {})) {
    const value = row[field];
    if (typeof value === 'string') {
      formatted[field] = formattedText(type, field, format, value);
    } else if (Array.isArray(value)) {
      formatted[field] = formattedElements(type, field, format, value);
    }
  }
  for (const field of rules?.sets ?? []) {
    const value = formatted[field];
    if (Array.isArray(value)) {
      formatted[field] = distinctElements(value);
    }
  }
  for (const field of rules?.documents ?? []) {
    const value = formatted[field];
    if (Array.isArray(value)) {
      formatted[field] = JSON.stringify(value);
    }
  }
  return formatted as T;
}

export function filledValue(value: unknown, fallback: unknown): unknown {
  return value === undefined || value === '' ? fallback : value;
}

function recordObject(record: unknown): Row {
  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    throw new TypeError('A record value holds no fields');
  }
  return record as Row;
}

export function storedRecordId(record: unknown): string | null {
  if (typeof record === 'string') {
    return record;
  }
  const { id } = recordObject(record);
  return typeof id === 'string' ? id : null;
}

export function recordValue(record: unknown, field: string): unknown {
  return recordObject(record)[field];
}

export function recordList(record: unknown, field: string): unknown[] {
  const value = recordValue(record, field);
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new TypeError(`'${field}' holds no list of records`);
  }
  return value;
}

export function unsavedRecord(record: unknown, field: string): Row | null {
  const value = recordValue(record, field);
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? recordObject(value)
    : null;
}

export function formatFields(type: string, row: Row): void {
  Object.assign(row, formattedRow(type, row));
}

export async function insertRecord(
  client: Queryable,
  callerId: string | null,
  type: string,
  row: Row
): Promise<void> {
  const formatted = formattedRow(type, row);
  const enforce = rulesOf(type)?.enforce ?? null;
  if (enforce !== null) {
    await enforce(client, mergedCandidate({}, formatted), null, null, callerId);
  }
  const columns = Object.keys(formatted);
  await client.query(
    `INSERT INTO "${type}" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})`,
    columns.map((column) => storedValue(type, column, formatted[column]))
  );
}

export async function updateRecord(
  client: Queryable,
  callerId: string | null,
  type: string,
  id: string,
  change: Row
): Promise<void> {
  const formatted = formattedRow(type, change);
  const enforce = rulesOf(type)?.enforce ?? null;
  if (enforce !== null) {
    const { rows } = await client.query<Row>(`SELECT * FROM "${type}" WHERE id = $1 FOR UPDATE`, [
      id,
    ]);
    const stored = rows.at(0);
    if (stored !== undefined) {
      await enforce(
        client,
        mergedCandidate(stored, formatted),
        mergedCandidate(stored, {}),
        id,
        callerId
      );
    }
  }
  const columns = Object.keys(formatted);
  await client.query(
    `UPDATE "${type}" SET ${columns.map((column, index) => `"${column}" = $${index + 1}`).join(', ')} WHERE id = $${columns.length + 1}`,
    [...columns.map((column) => storedValue(type, column, formatted[column])), id]
  );
}

interface EmbeddedWrites {
  insert(client: Queryable, type: string, row: Row): Promise<void>;
  update(client: Queryable, type: string, id: string, change: Row): Promise<void>;
  unreadableFile(
    body: Row,
    fileFields: string[],
    loadKept: () => Promise<Row | null>
  ): Promise<boolean>;
}

export function embeddedWrites(caller: Caller): EmbeddedWrites {
  return {
    insert: (client: Queryable, type: string, row: Row): Promise<void> =>
      insertRecord(client, caller.userId, type, row),
    update: (client: Queryable, type: string, id: string, change: Row): Promise<void> =>
      updateRecord(client, caller.userId, type, id, change),
    unreadableFile: (
      body: Row,
      fileFields: string[],
      loadKept: () => Promise<Row | null>
    ): Promise<boolean> => unreadableFile(body, fileFields, caller, loadKept),
  };
}

export async function updateSingletonRecord(
  client: Queryable,
  callerId: string | null,
  type: string,
  change: Row
): Promise<boolean> {
  const { rows } = await client.query<Row>(`SELECT id FROM "${type}" LIMIT 1`);
  const stored = rows.at(0);
  if (stored === undefined) {
    return false;
  }
  await updateRecord(client, callerId, type, String(stored['id']), change);
  return true;
}
