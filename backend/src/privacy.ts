import type { Queryable } from './db.js';

const USER_TABLE = 'user';
const FILE_ELEMENT = 'file';
const BACKUP_COLUMN_PREFIX = '$OLD_';
const ACCOUNT_RECORD_DELETIONS: string[] = [];

interface PrivacyColumn {
  identifier: string;
  reference: string | null;
  collection: boolean;
  personal: boolean;
  subject: boolean;
  scrub: unknown;
}

interface PrivacyTable {
  name: string;
  columns: PrivacyColumn[];
  identityStrong: string[];
  identityComposite: string[][];
}

interface PrivacyResource {
  name: string;
  table: string;
  ownershipTable: string | null;
  ownershipIdColumn: string;
}

const PRIVACY_TABLES: PrivacyTable[] = [
  {
    name: 'GameType',
    columns: [
      {
        identifier: 'id',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: '[redacted]',
      },
      {
        identifier: 'name',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: '[redacted]',
      },
      {
        identifier: 'category',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: 'chess',
      },
      {
        identifier: 'rulesVariant',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: '[redacted]',
      },
      {
        identifier: 'defaultRating',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: 0,
      },
      {
        identifier: 'description',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: '[redacted]',
      },
    ],
    identityStrong: [],
    identityComposite: [],
  },
  {
    name: 'Player',
    columns: [
      {
        identifier: 'id',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: '[redacted]',
      },
      {
        identifier: 'nickname',
        reference: null,
        collection: false,
        personal: true,
        subject: true,
        scrub: '[redacted]',
      },
      {
        identifier: 'fullName',
        reference: null,
        collection: false,
        personal: true,
        subject: false,
        scrub: '[redacted]',
      },
      {
        identifier: 'emailAddress',
        reference: null,
        collection: false,
        personal: true,
        subject: false,
        scrub: '[redacted]',
      },
      {
        identifier: 'avatar',
        reference: 'file',
        collection: false,
        personal: true,
        subject: false,
        scrub: '',
      },
      {
        identifier: 'bio',
        reference: null,
        collection: false,
        personal: true,
        subject: false,
        scrub: '[redacted]',
      },
      {
        identifier: 'joinedDate',
        reference: null,
        collection: false,
        personal: true,
        subject: false,
        scrub: '1970-01-01',
      },
      {
        identifier: 'userAccountId',
        reference: 'user',
        collection: false,
        personal: true,
        subject: false,
        scrub: '',
      },
    ],
    identityStrong: ['emailAddress'],
    identityComposite: [],
  },
  {
    name: 'LeaderboardEntry',
    columns: [
      {
        identifier: 'id',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: '[redacted]',
      },
      {
        identifier: 'playerId',
        reference: 'Player',
        collection: false,
        personal: false,
        subject: false,
        scrub: '',
      },
      {
        identifier: 'gameId',
        reference: 'GameType',
        collection: false,
        personal: false,
        subject: false,
        scrub: '',
      },
      {
        identifier: 'rating',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: 0,
      },
      {
        identifier: 'matchesPlayed',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: 0,
      },
      {
        identifier: 'wins',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: 0,
      },
      {
        identifier: 'losses',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: 0,
      },
      {
        identifier: 'draws',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: 0,
      },
      {
        identifier: 'lastPlayedAt',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: '1970-01-01T00:00:00.000Z',
      },
    ],
    identityStrong: [],
    identityComposite: [],
  },
  {
    name: 'Match',
    columns: [
      {
        identifier: 'id',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: '[redacted]',
      },
      {
        identifier: 'gameId',
        reference: 'GameType',
        collection: false,
        personal: false,
        subject: false,
        scrub: '',
      },
      {
        identifier: 'playerOneId',
        reference: 'Player',
        collection: false,
        personal: false,
        subject: false,
        scrub: '',
      },
      {
        identifier: 'playerTwoId',
        reference: 'Player',
        collection: false,
        personal: false,
        subject: false,
        scrub: '',
      },
      {
        identifier: 'scheduledAt',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: '1970-01-01T00:00:00.000Z',
      },
      {
        identifier: 'status',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: 'scheduled',
      },
      {
        identifier: 'outcome',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: 'playerOneWin',
      },
      {
        identifier: 'playerOneScore',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: 0,
      },
      {
        identifier: 'playerTwoScore',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: 0,
      },
      {
        identifier: 'playerOneRatingDelta',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: 0,
      },
      {
        identifier: 'playerTwoRatingDelta',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: 0,
      },
      {
        identifier: 'notes',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: '[redacted]',
      },
      {
        identifier: 'recordedById',
        reference: 'user',
        collection: false,
        personal: false,
        subject: false,
        scrub: '',
      },
      {
        identifier: 'createdAt',
        reference: null,
        collection: false,
        personal: false,
        subject: false,
        scrub: '1970-01-01T00:00:00.000Z',
      },
    ],
    identityStrong: [],
    identityComposite: [],
  },
];

const PRIVACY_RESOURCES: PrivacyResource[] = [
  {
    name: 'games',
    table: 'GameType',
    ownershipTable: null,
    ownershipIdColumn: 'gameTypeId',
  },
  {
    name: 'players',
    table: 'Player',
    ownershipTable: null,
    ownershipIdColumn: 'playerId',
  },
  {
    name: 'matches',
    table: 'Match',
    ownershipTable: 'creator_matches',
    ownershipIdColumn: 'matchId',
  },
  {
    name: 'leaderboards',
    table: 'LeaderboardEntry',
    ownershipTable: null,
    ownershipIdColumn: 'leaderboardEntryId',
  },
];

type Row = Record<string, unknown>;

export interface PersonalRecord {
  id: string;
  fields: Row;
}

export interface PersonalResourceReport {
  resource: string;
  records: PersonalRecord[];
}

export interface PersonalDataReport {
  userId: string;
  resources: PersonalResourceReport[];
}

export interface SubjectSeed {
  userId: string | null;
  strongValues: Set<string>;
  attributes: Map<string, string>;
}

export interface SubjectIndexEntry {
  email: string;
  name: string;
  attributes: Record<string, string>;
  userId: string | null;
}

function normalizeIdentity(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function identitySeed(input: {
  userId: string | null;
  strongValues: string[];
  attributes: Record<string, string>;
}): SubjectSeed {
  const strongValues = new Set<string>();
  for (const value of input.strongValues) {
    const normalized = normalizeIdentity(value);
    if (normalized !== '') {
      strongValues.add(normalized);
    }
  }
  const attributes = new Map<string, string>();
  for (const [field, value] of Object.entries(input.attributes)) {
    const normalized = normalizeIdentity(value);
    if (normalized !== '') {
      attributes.set(field, normalized);
    }
  }
  return { userId: input.userId, strongValues, attributes };
}

export async function seedForUser(client: Queryable, userId: string): Promise<SubjectSeed> {
  const { rows } = await client.query<Row>('SELECT email FROM "user" WHERE id = $1', [userId]);
  const email = typeof rows[0]?.['email'] === 'string' ? rows[0]['email'] : '';
  return identitySeed({ userId, strongValues: email === '' ? [] : [email], attributes: {} });
}

function tableOf(name: string): PrivacyTable | undefined {
  return PRIVACY_TABLES.find((table) => table.name === name);
}

function personalColumns(table: PrivacyTable): PrivacyColumn[] {
  return table.columns.filter((column) => column.personal);
}

function referencedIds(record: Row, column: PrivacyColumn): string[] {
  const value = record[column.identifier];
  if (column.collection) {
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === 'string' && id !== '')
      : [];
  }
  return typeof value === 'string' && value !== '' ? [value] : [];
}

function strongMatches(record: Row, table: PrivacyTable, seed: SubjectSeed): boolean {
  return table.identityStrong.some((field) => {
    const value = normalizeIdentity(record[field]);
    return value !== '' && seed.strongValues.has(value);
  });
}

function groupMatches(record: Row, group: string[], seed: SubjectSeed): boolean {
  if (group.length === 0) {
    return false;
  }
  return group.every((field) => {
    const expected = seed.attributes.get(field);
    const value = normalizeIdentity(record[field]);
    return expected !== undefined && value !== '' && value === expected;
  });
}

function compositeMatches(record: Row, table: PrivacyTable, seed: SubjectSeed): boolean {
  return table.identityComposite.some((group) => groupMatches(record, group, seed));
}

function hasStrongValue(record: Row, strongFields: string[]): boolean {
  return strongFields.some((field) => {
    const value = record[field];
    return typeof value === 'string' && value.trim() !== '';
  });
}

function compositeAttributes(record: Row, group: string[]): Record<string, string> | null {
  const attributes: Record<string, string> = {};
  for (const field of group) {
    const value = record[field];
    if (typeof value !== 'string' || value.trim() === '') {
      return null;
    }
    attributes[field] = value.trim();
  }
  return attributes;
}

function carriesOwnIdentity(record: Row, table: PrivacyTable): boolean {
  if (hasStrongValue(record, table.identityStrong)) {
    return true;
  }
  return table.identityComposite.some((group) => compositeAttributes(record, group) !== null);
}

function identifiesDistinctSubject(record: Row, table: PrivacyTable, seed: SubjectSeed): boolean {
  if (!carriesOwnIdentity(record, table)) {
    return false;
  }
  return !(strongMatches(record, table, seed) || compositeMatches(record, table, seed));
}

function isIdentityTable(name: string): boolean {
  if (name === USER_TABLE) {
    return true;
  }
  const table = tableOf(name);
  return (
    table !== undefined && (table.identityStrong.length > 0 || table.identityComposite.length > 0)
  );
}

function subjectReferenceIds(
  seed: SubjectSeed,
  subjectIds: Map<string, Set<string>>,
  targetTable: string
): Set<string> {
  const ids = new Set(subjectIds.get(targetTable) ?? []);
  if (targetTable === USER_TABLE && seed.userId !== null && seed.userId !== '') {
    ids.add(seed.userId);
  }
  return ids;
}

function linksOtherIdentity(
  record: Row,
  table: PrivacyTable,
  seed: SubjectSeed,
  subjectIds: Map<string, Set<string>>
): boolean {
  for (const column of table.columns) {
    const target = column.reference;
    if (target !== null && target !== FILE_ELEMENT && isIdentityTable(target)) {
      const referenced = referencedIds(record, column);
      if (column.collection && referenced.length > 0) {
        return true;
      }
      const subjects = subjectReferenceIds(seed, subjectIds, target);
      if (referenced.some((id) => !subjects.has(id))) {
        return true;
      }
    }
  }
  return false;
}

function referencesMatched(
  record: Row,
  table: PrivacyTable,
  matched: Map<string, Set<string>>
): boolean {
  for (const column of table.columns) {
    const set = column.reference === null ? undefined : matched.get(column.reference);
    if (set !== undefined && referencedIds(record, column).some((id) => set.has(id))) {
      return true;
    }
  }
  return false;
}

async function tableRows(client: Queryable, table: string): Promise<Row[]> {
  const { rows } = await client.query<Row>(`SELECT * FROM "${table}"`);
  return rows;
}

async function loadAllRows(client: Queryable): Promise<Map<string, Row[]>> {
  const rows = new Map<string, Row[]>();
  for (const resource of PRIVACY_RESOURCES) {
    if (!rows.has(resource.table)) {
      rows.set(resource.table, await tableRows(client, resource.table));
    }
  }
  return rows;
}

async function ownedRecordIds(
  client: Queryable,
  resource: PrivacyResource,
  userId: string
): Promise<string[]> {
  if (resource.ownershipTable === null) {
    return [];
  }
  const { rows } = await client.query<Row>(
    `SELECT "${resource.ownershipIdColumn}" AS "recordId" FROM "${resource.ownershipTable}" WHERE "userId" = $1`,
    [userId]
  );
  return rows
    .map((row) => row['recordId'])
    .filter((id): id is string => typeof id === 'string' && id !== '');
}

async function seededTargets(
  client: Queryable,
  seed: SubjectSeed,
  rows: Map<string, Row[]>
): Promise<Map<string, Set<string>>> {
  const matched = new Map<string, Set<string>>();
  for (const resource of PRIVACY_RESOURCES) {
    const table = tableOf(resource.table);
    const ids = matched.get(resource.table) ?? new Set<string>();
    if (seed.userId !== null && seed.userId !== '') {
      for (const id of await ownedRecordIds(client, resource, seed.userId)) {
        ids.add(id);
      }
    }
    if (table !== undefined && table.identityStrong.length > 0) {
      for (const record of rows.get(resource.table) ?? []) {
        const { id } = record;
        if (typeof id === 'string' && id !== '' && strongMatches(record, table, seed)) {
          ids.add(id);
        }
      }
    }
    matched.set(resource.table, ids);
  }
  return matched;
}

function snapshotMatched(matched: Map<string, Set<string>>): Map<string, Set<string>> {
  const snapshot = new Map<string, Set<string>>();
  for (const [table, ids] of matched) {
    snapshot.set(table, new Set(ids));
  }
  return snapshot;
}

function expandReferenceReach(
  matched: Map<string, Set<string>>,
  seed: SubjectSeed,
  rows: Map<string, Row[]>
): void {
  const subjectIds = snapshotMatched(matched);
  for (const resource of PRIVACY_RESOURCES) {
    const table = tableOf(resource.table);
    const reached = matched.get(resource.table) ?? new Set<string>();
    if (table !== undefined) {
      for (const record of rows.get(resource.table) ?? []) {
        const { id } = record;
        const fresh = typeof id === 'string' && id !== '' && !reached.has(id);
        if (
          fresh &&
          referencesMatched(record, table, subjectIds) &&
          !identifiesDistinctSubject(record, table, seed) &&
          !linksOtherIdentity(record, table, seed, subjectIds)
        ) {
          reached.add(id);
        }
      }
    }
    matched.set(resource.table, reached);
  }
}

function projectColumns(record: Row, columns: PrivacyColumn[]): Row {
  const fields: Row = {};
  for (const column of columns) {
    const value = record[column.identifier];
    if (value !== undefined) {
      fields[column.identifier] = value;
    }
  }
  return fields;
}

function reportFromMatched(
  matched: Map<string, Set<string>>,
  rows: Map<string, Row[]>,
  userId: string
): PersonalDataReport {
  const resources: PersonalResourceReport[] = [];
  for (const resource of PRIVACY_RESOURCES) {
    const table = tableOf(resource.table);
    const columns = table === undefined ? [] : personalColumns(table);
    const ids = matched.get(resource.table) ?? new Set<string>();
    if (columns.length > 0 && ids.size > 0) {
      const records: PersonalRecord[] = [];
      for (const record of rows.get(resource.table) ?? []) {
        const { id } = record;
        if (typeof id === 'string' && ids.has(id)) {
          records.push({ id, fields: projectColumns(record, columns) });
        }
      }
      if (records.length > 0) {
        resources.push({ resource: resource.name, records });
      }
    }
  }
  return { userId, resources };
}

export async function buildReportForSeed(
  client: Queryable,
  seed: SubjectSeed
): Promise<PersonalDataReport> {
  const rows = await loadAllRows(client);
  const matched = await seededTargets(client, seed, rows);
  expandReferenceReach(matched, seed, rows);
  return reportFromMatched(matched, rows, seed.userId ?? '');
}

export async function buildAdminReport(
  client: Queryable,
  seed: SubjectSeed
): Promise<PersonalDataReport> {
  const rows = await loadAllRows(client);
  const matched = await seededTargets(client, seed, rows);
  for (const resource of PRIVACY_RESOURCES) {
    const table = tableOf(resource.table);
    if (table !== undefined) {
      const ids = matched.get(resource.table) ?? new Set<string>();
      for (const record of rows.get(resource.table) ?? []) {
        const { id } = record;
        if (typeof id === 'string' && id !== '' && compositeMatches(record, table, seed)) {
          ids.add(id);
        }
      }
      matched.set(resource.table, ids);
    }
  }
  expandReferenceReach(matched, seed, rows);
  return reportFromMatched(matched, rows, seed.userId ?? '');
}

function subjectName(record: Row, table: PrivacyTable): string {
  for (const column of table.columns) {
    if (column.subject) {
      const value = record[column.identifier];
      if (typeof value === 'string' && value.trim() !== '') {
        return value.trim();
      }
    }
  }
  return '';
}

export async function buildSubjectIndex(client: Queryable): Promise<SubjectIndexEntry[]> {
  const byKey = new Map<string, SubjectIndexEntry>();
  for (const user of await tableRows(client, USER_TABLE)) {
    const email = typeof user['email'] === 'string' ? user['email'].trim() : '';
    if (email !== '') {
      byKey.set(email.toLowerCase(), {
        email,
        name: typeof user['name'] === 'string' ? user['name'] : '',
        attributes: {},
        userId: typeof user['id'] === 'string' ? user['id'] : null,
      });
    }
  }
  for (const resource of PRIVACY_RESOURCES) {
    const table = tableOf(resource.table);
    if (
      table !== undefined &&
      (table.identityStrong.length > 0 || table.identityComposite.length > 0)
    ) {
      for (const record of await tableRows(client, resource.table)) {
        for (const field of table.identityStrong) {
          const raw = record[field];
          if (
            typeof raw === 'string' &&
            raw.trim() !== '' &&
            !byKey.has(raw.trim().toLowerCase())
          ) {
            byKey.set(raw.trim().toLowerCase(), {
              email: raw.trim(),
              name: subjectName(record, table),
              attributes: {},
              userId: null,
            });
          }
        }
        if (!hasStrongValue(record, table.identityStrong)) {
          for (const group of table.identityComposite) {
            const attributes = compositeAttributes(record, group);
            if (attributes !== null) {
              const key = `composite:${group.map((field) => (attributes[field] ?? '').toLowerCase()).join('|')}`;
              if (!byKey.has(key)) {
                byKey.set(key, {
                  email: '',
                  name: subjectName(record, table),
                  attributes,
                  userId: null,
                });
              }
            }
          }
        }
      }
    }
  }
  return [...byKey.values()];
}

export async function findCompositeCandidates(
  client: Queryable,
  seed: SubjectSeed
): Promise<PersonalResourceReport[]> {
  const rows = await loadAllRows(client);
  const seeded = await seededTargets(client, seed, rows);
  const candidates: PersonalResourceReport[] = [];
  for (const resource of PRIVACY_RESOURCES) {
    const table = tableOf(resource.table);
    if (table !== undefined) {
      const columns = personalColumns(table);
      const already = seeded.get(resource.table) ?? new Set<string>();
      const records: PersonalRecord[] = [];
      for (const record of rows.get(resource.table) ?? []) {
        const { id } = record;
        if (
          typeof id === 'string' &&
          id !== '' &&
          !already.has(id) &&
          compositeMatches(record, table, seed)
        ) {
          records.push({ id, fields: projectColumns(record, columns) });
        }
      }
      if (records.length > 0) {
        candidates.push({ resource: resource.name, records });
      }
    }
  }
  return candidates;
}

function fileColumns(columns: PrivacyColumn[]): PrivacyColumn[] {
  return columns.filter((column) => column.reference === FILE_ELEMENT);
}

function collectFileIds(
  records: Row[],
  ids: Set<string>,
  columns: PrivacyColumn[],
  files: Set<string>
): void {
  const uploads = fileColumns(columns);
  for (const record of records) {
    const { id } = record;
    if (typeof id === 'string' && ids.has(id)) {
      for (const column of uploads) {
        for (const fileId of referencedIds(record, column)) {
          files.add(fileId);
        }
      }
    }
  }
}

async function retainedFileIds(client: Queryable): Promise<Set<string>> {
  const retained = new Set<string>();
  for (const table of PRIVACY_TABLES) {
    const uploads = fileColumns(table.columns);
    if (uploads.length > 0) {
      for (const record of await tableRows(client, table.name)) {
        for (const column of uploads) {
          for (const fileId of referencedIds(record, column)) {
            retained.add(fileId);
          }
        }
      }
    }
  }
  return retained;
}

async function deleteUnreferencedFiles(client: Queryable, files: Set<string>): Promise<void> {
  if (files.size === 0) {
    return;
  }
  const retained = await retainedFileIds(client);
  for (const fileId of files) {
    if (!retained.has(fileId)) {
      await client.query('DELETE FROM "$FILES" WHERE id = $1', [fileId]);
    }
  }
}

async function backupColumnsOf(client: Queryable, tableName: string): Promise<string[]> {
  const { rows } = await client.query<{ column_name: string }>(
    'SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND starts_with(column_name, $2)',
    [tableName, BACKUP_COLUMN_PREFIX]
  );
  return rows.map((row) => row.column_name);
}

function quotedIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function anonymizeRecords(
  client: Queryable,
  resource: PrivacyResource,
  ids: Set<string>
): Promise<void> {
  if (ids.size === 0) {
    return;
  }
  const table = tableOf(resource.table);
  const columns = table === undefined ? [] : personalColumns(table);
  const backups = await backupColumnsOf(client, resource.table);
  if (columns.length === 0 && backups.length === 0) {
    return;
  }
  const assignments = [
    ...columns.map((column, index) => `${quotedIdentifier(column.identifier)} = $${index + 2}`),
    ...backups.map((column) => `${quotedIdentifier(column)} = NULL`),
  ].join(', ');
  const values = columns.map((column) => column.scrub);
  for (const id of ids) {
    await client.query(`UPDATE "${resource.table}" SET ${assignments} WHERE id = $1`, [
      id,
      ...values,
    ]);
  }
}

async function deleteRecords(
  client: Queryable,
  resource: PrivacyResource,
  ids: Set<string>,
  userId: string | null
): Promise<void> {
  for (const id of ids) {
    await client.query(`DELETE FROM "${resource.table}" WHERE id = $1`, [id]);
  }
  if (resource.ownershipTable !== null && userId !== null && userId !== '') {
    await client.query(`DELETE FROM "${resource.ownershipTable}" WHERE "userId" = $1`, [userId]);
  }
}

function mergeGranted(matched: Map<string, Set<string>>, granted: Map<string, Set<string>>): void {
  for (const resource of PRIVACY_RESOURCES) {
    const ids = matched.get(resource.table) ?? new Set<string>();
    for (const id of granted.get(resource.name) ?? []) {
      ids.add(id);
    }
    matched.set(resource.table, ids);
  }
}

function referenceOnlyIds(reached: Set<string> | undefined, subjectIds: Set<string>): Set<string> {
  const ids = new Set<string>();
  for (const id of reached ?? []) {
    if (!subjectIds.has(id)) {
      ids.add(id);
    }
  }
  return ids;
}

export async function eraseIdentitySubject(
  client: Queryable,
  seed: SubjectSeed,
  granted: Map<string, Set<string>>,
  resolution: 'anonymize' | 'delete'
): Promise<void> {
  await client.query('SET CONSTRAINTS ALL DEFERRED');
  const rows = await loadAllRows(client);
  const subject = await seededTargets(client, seed, rows);
  mergeGranted(subject, granted);
  const withReach = snapshotMatched(subject);
  expandReferenceReach(withReach, seed, rows);
  const files = new Set<string>();
  for (const resource of PRIVACY_RESOURCES) {
    const table = tableOf(resource.table);
    const subjectIds = subject.get(resource.table) ?? new Set<string>();
    const referencing = referenceOnlyIds(withReach.get(resource.table), subjectIds);
    if (table !== undefined) {
      const records = rows.get(resource.table) ?? [];
      const cleared = resolution === 'anonymize' ? personalColumns(table) : table.columns;
      collectFileIds(records, subjectIds, cleared, files);
      collectFileIds(records, referencing, personalColumns(table), files);
    }
    if (resolution === 'anonymize') {
      await anonymizeRecords(client, resource, subjectIds);
    } else {
      await deleteRecords(client, resource, subjectIds, seed.userId);
    }
    await anonymizeRecords(client, resource, referencing);
  }
  await deleteUnreferencedFiles(client, files);
}

export async function deleteUserAccount(client: Queryable, userId: string): Promise<void> {
  for (const statement of ACCOUNT_RECORD_DELETIONS) {
    await client.query(statement, [userId]);
  }
  await client.query('DELETE FROM "account" WHERE "userId" = $1', [userId]);
  await client.query('DELETE FROM "session" WHERE "userId" = $1', [userId]);
  await client.query('DELETE FROM "app_user_role" WHERE "userId" = $1', [userId]);
  await client.query('DELETE FROM "user" WHERE id = $1', [userId]);
}
