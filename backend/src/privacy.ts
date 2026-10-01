import type { Queryable } from './db.js';

const USER_TABLE = 'user';
const FILE_ELEMENT = 'file';
const BACKUP_COLUMN_PREFIX = '$OLD_';
const ACCOUNT_RECORD_DELETIONS: string[] = [];

interface PrivacyColumn {
  identifier: string;
  reference: string | null;
  collection: boolean;
  contained: boolean;
  personal: boolean;
  subject: boolean;
  scrub: unknown;
}

interface PrivacyChild {
  identifier: string;
  table: string;
  foreignKey: string;
  personal: boolean;
}

interface PrivacyTable {
  name: string;
  columns: PrivacyColumn[];
  children: PrivacyChild[];
  identityStrong: string[];
  identityComposite: string[][];
}

interface InboundReference {
  table: string;
  column: string;
  list: boolean;
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
        contained: false,
        personal: false,
        subject: false,
        scrub: '[redacted]',
      },
      {
        identifier: 'name',
        reference: null,
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: '[redacted]',
      },
      {
        identifier: 'category',
        reference: null,
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: '',
      },
      {
        identifier: 'rulesVariant',
        reference: null,
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: '[redacted]',
      },
      {
        identifier: 'defaultRating',
        reference: null,
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: 0,
      },
      {
        identifier: 'description',
        reference: null,
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: '[redacted]',
      },
    ],
    children: [],
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
        contained: false,
        personal: false,
        subject: false,
        scrub: '[redacted]',
      },
      {
        identifier: 'nickname',
        reference: null,
        collection: false,
        contained: false,
        personal: true,
        subject: true,
        scrub: '[redacted]',
      },
      {
        identifier: 'fullName',
        reference: null,
        collection: false,
        contained: false,
        personal: true,
        subject: false,
        scrub: '[redacted]',
      },
      {
        identifier: 'emailAddress',
        reference: null,
        collection: false,
        contained: false,
        personal: true,
        subject: false,
        scrub: '',
      },
      {
        identifier: 'avatar',
        reference: 'file',
        collection: false,
        contained: false,
        personal: true,
        subject: false,
        scrub: '',
      },
      {
        identifier: 'bio',
        reference: null,
        collection: false,
        contained: false,
        personal: true,
        subject: false,
        scrub: '[redacted]',
      },
      {
        identifier: 'joinedDate',
        reference: null,
        collection: false,
        contained: false,
        personal: true,
        subject: false,
        scrub: null,
      },
      {
        identifier: 'userAccountId',
        reference: 'user',
        collection: false,
        contained: false,
        personal: true,
        subject: false,
        scrub: '',
      },
    ],
    children: [],
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
        contained: false,
        personal: false,
        subject: false,
        scrub: '[redacted]',
      },
      {
        identifier: 'playerId',
        reference: 'Player',
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: '',
      },
      {
        identifier: 'gameId',
        reference: 'GameType',
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: '',
      },
      {
        identifier: 'rating',
        reference: null,
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: 0,
      },
      {
        identifier: 'matchesPlayed',
        reference: null,
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: 0,
      },
      {
        identifier: 'wins',
        reference: null,
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: 0,
      },
      {
        identifier: 'losses',
        reference: null,
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: 0,
      },
      {
        identifier: 'draws',
        reference: null,
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: 0,
      },
      {
        identifier: 'lastPlayedAt',
        reference: null,
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: null,
      },
    ],
    children: [],
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
        contained: false,
        personal: false,
        subject: false,
        scrub: '[redacted]',
      },
      {
        identifier: 'gameId',
        reference: 'GameType',
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: '',
      },
      {
        identifier: 'playerOneId',
        reference: 'Player',
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: '',
      },
      {
        identifier: 'playerTwoId',
        reference: 'Player',
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: '',
      },
      {
        identifier: 'scheduledAt',
        reference: null,
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: null,
      },
      {
        identifier: 'status',
        reference: null,
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: '',
      },
      {
        identifier: 'outcome',
        reference: null,
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: '',
      },
      {
        identifier: 'playerOneScore',
        reference: null,
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: 0,
      },
      {
        identifier: 'playerTwoScore',
        reference: null,
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: 0,
      },
      {
        identifier: 'playerOneRatingDelta',
        reference: null,
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: 0,
      },
      {
        identifier: 'playerTwoRatingDelta',
        reference: null,
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: 0,
      },
      {
        identifier: 'notes',
        reference: null,
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: '[redacted]',
      },
      {
        identifier: 'recordedById',
        reference: 'user',
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: '',
      },
      {
        identifier: 'createdAt',
        reference: null,
        collection: false,
        contained: false,
        personal: false,
        subject: false,
        scrub: null,
      },
    ],
    children: [],
    identityStrong: [],
    identityComposite: [],
  },
];

const PRIVACY_RESOURCES: PrivacyResource[] = [
  {
    name: 'games',
    table: 'GameType',
    ownershipTable: 'creator_games',
    ownershipIdColumn: 'gameTypeId',
  },
  {
    name: 'players',
    table: 'Player',
    ownershipTable: 'creator_players',
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
    ownershipTable: 'creator_leaderboards',
    ownershipIdColumn: 'leaderboardEntryId',
  },
];

const INBOUND_REFERENCES: Record<string, InboundReference[] | undefined> = {
  Player: [
    {
      table: 'LeaderboardEntry',
      column: 'playerId',
      list: false,
    },
    {
      table: 'Match',
      column: 'playerOneId',
      list: false,
    },
    {
      table: 'Match',
      column: 'playerTwoId',
      list: false,
    },
  ],
  GameType: [
    {
      table: 'LeaderboardEntry',
      column: 'gameId',
      list: false,
    },
    {
      table: 'Match',
      column: 'gameId',
      list: false,
    },
  ],
};

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

interface Holding {
  key: string;
  personal: boolean;
  single: boolean;
  table: PrivacyTable;
  records: Row[];
}

interface GrantGroup {
  key: string;
  table: PrivacyTable;
}

interface Inventory {
  tables: PrivacyTable[];
  rows: Map<string, Map<string, Row>>;
}

type Matched = Map<string, Set<string>>;

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

export async function verifiedAccountEmail(client: Queryable, userId: string): Promise<string> {
  const { rows } = await client.query<Row>(
    'SELECT email, "emailVerified" FROM "user" WHERE id = $1',
    [userId]
  );
  const account = rows.at(0);
  return account?.['emailVerified'] === true && typeof account['email'] === 'string'
    ? account['email']
    : '';
}

export async function seedForUser(client: Queryable, userId: string): Promise<SubjectSeed> {
  const email = await verifiedAccountEmail(client, userId);
  return identitySeed({ userId, strongValues: email === '' ? [] : [email], attributes: {} });
}

function recordId(record: Row): string {
  const { id } = record;
  return typeof id === 'string' ? id : '';
}

function text(record: Row, field: string): string {
  const value = record[field];
  return typeof value === 'string' ? value : '';
}

function tableOf(name: string): PrivacyTable {
  const table = PRIVACY_TABLES.find((candidate) => candidate.name === name);
  if (table === undefined) {
    throw new Error(`Table "${name}" is missing from the privacy model`);
  }
  return table;
}

function isResourceTable(name: string): boolean {
  return PRIVACY_RESOURCES.some((resource) => resource.table === name);
}

function recordTables(): PrivacyTable[] {
  const tables: PrivacyTable[] = [];
  const pending = PRIVACY_RESOURCES.map((resource) => resource.table);
  let name = pending.pop();
  while (name !== undefined) {
    const table = tableOf(name);
    if (!tables.includes(table)) {
      tables.push(table);
      for (const column of table.columns) {
        if (column.contained && column.reference !== null) {
          pending.push(column.reference);
        }
      }
      for (const child of table.children) {
        pending.push(child.table);
      }
    }
    name = pending.pop();
  }
  return tables;
}

function personalColumns(table: PrivacyTable): PrivacyColumn[] {
  return table.columns.filter((column) => column.personal);
}

function idsOf(matched: Matched, table: string): Set<string> {
  return matched.get(table) ?? new Set<string>();
}

function matchedIds(matched: Matched, table: string): Set<string> {
  const existing = matched.get(table);
  if (existing !== undefined) {
    return existing;
  }
  const ids = new Set<string>();
  matched.set(table, ids);
  return ids;
}

function referencedIds(record: Row, column: PrivacyColumn): string[] {
  const value = record[column.identifier];
  if (!column.collection) {
    return typeof value === 'string' && value !== '' ? [value] : [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`Stored list "${column.identifier}" was not decoded into a list`);
  }
  return value.filter((id): id is string => typeof id === 'string' && id !== '');
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
  return strongFields.some((field) => text(record, field).trim() !== '');
}

function compositeAttributes(record: Row, group: string[]): Record<string, string> | null {
  const attributes: Record<string, string> = {};
  for (const field of group) {
    const value = text(record, field).trim();
    if (value === '') {
      return null;
    }
    attributes[field] = value;
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
  const table = PRIVACY_TABLES.find((candidate) => candidate.name === name);
  return (
    table !== undefined && (table.identityStrong.length > 0 || table.identityComposite.length > 0)
  );
}

function subjectReferenceIds(
  seed: SubjectSeed,
  subjectIds: Matched,
  targetTable: string
): Set<string> {
  const ids = new Set(idsOf(subjectIds, targetTable));
  if (targetTable === USER_TABLE && seed.userId !== null && seed.userId !== '') {
    ids.add(seed.userId);
  }
  return ids;
}

function linksOtherIdentity(
  record: Row,
  table: PrivacyTable,
  seed: SubjectSeed,
  subjectIds: Matched
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

function referencesMatched(record: Row, table: PrivacyTable, matched: Matched): boolean {
  for (const column of table.columns) {
    const set =
      column.reference === null || column.contained ? undefined : matched.get(column.reference);
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

async function takeInventory(client: Queryable): Promise<Inventory> {
  const inventory: Inventory = { tables: recordTables(), rows: new Map() };
  for (const table of inventory.tables) {
    const byId = new Map<string, Row>();
    for (const row of await tableRows(client, table.name)) {
      const id = recordId(row);
      if (id !== '') {
        byId.set(id, row);
      }
    }
    inventory.rows.set(table.name, byId);
  }
  return inventory;
}

function rowsOf(inventory: Inventory, table: string): Row[] {
  return [...(inventory.rows.get(table)?.values() ?? [])];
}

function findRow(inventory: Inventory, table: string, id: string): Row | null {
  return inventory.rows.get(table)?.get(id) ?? null;
}

function holdings(inventory: Inventory, table: PrivacyTable, record: Row): Holding[] {
  const held: Holding[] = [];
  for (const column of table.columns) {
    if (column.contained && column.reference !== null) {
      const child = findRow(inventory, column.reference, text(record, column.identifier));
      held.push({
        key: column.identifier,
        personal: column.personal,
        single: true,
        table: tableOf(column.reference),
        records: child === null ? [] : [child],
      });
    }
  }
  const id = recordId(record);
  for (const child of table.children) {
    held.push({
      key: child.identifier,
      personal: child.personal,
      single: false,
      table: tableOf(child.table),
      records: rowsOf(inventory, child.table).filter((row) => text(row, child.foreignKey) === id),
    });
  }
  return held;
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
  return rows.map((row) => text(row, 'recordId')).filter((id) => id !== '');
}

async function seededTargets(
  client: Queryable,
  inventory: Inventory,
  seed: SubjectSeed
): Promise<Matched> {
  const matched: Matched = new Map();
  for (const resource of PRIVACY_RESOURCES) {
    const ids = matchedIds(matched, resource.table);
    if (seed.userId !== null && seed.userId !== '') {
      for (const id of await ownedRecordIds(client, resource, seed.userId)) {
        ids.add(id);
      }
    }
  }
  for (const table of inventory.tables) {
    const ids = matchedIds(matched, table.name);
    if (table.identityStrong.length > 0) {
      for (const record of rowsOf(inventory, table.name)) {
        if (strongMatches(record, table, seed)) {
          ids.add(recordId(record));
        }
      }
    }
  }
  return matched;
}

function snapshotMatched(matched: Matched): Matched {
  const snapshot: Matched = new Map();
  for (const [table, ids] of matched) {
    snapshot.set(table, new Set(ids));
  }
  return snapshot;
}

function expandReferenceReach(inventory: Inventory, matched: Matched, seed: SubjectSeed): void {
  const subjectIds = snapshotMatched(matched);
  for (const table of inventory.tables) {
    const reached = matchedIds(matched, table.name);
    for (const record of rowsOf(inventory, table.name)) {
      const id = recordId(record);
      if (
        !reached.has(id) &&
        referencesMatched(record, table, subjectIds) &&
        !identifiesDistinctSubject(record, table, seed) &&
        !linksOtherIdentity(record, table, seed, subjectIds)
      ) {
        reached.add(id);
      }
    }
  }
}

function personalFields(
  inventory: Inventory,
  matched: Matched,
  table: PrivacyTable,
  record: Row,
  whole: boolean
): Row | null {
  const owned = whole || idsOf(matched, table.name).has(recordId(record));
  const fields: Row = {};
  let found = whole;
  for (const column of table.columns) {
    if (!column.contained) {
      const counted = whole ? column.identifier !== 'id' : owned && column.personal;
      found ||= counted;
      const value = record[column.identifier];
      if (counted && value !== undefined) {
        fields[column.identifier] = value;
      }
    }
  }
  for (const holding of holdings(inventory, table, record)) {
    const counted = whole || (owned && holding.personal);
    found ||= counted;
    const entries: Row[] = [];
    for (const child of holding.records) {
      const childFields = personalFields(inventory, matched, holding.table, child, counted);
      if (childFields !== null) {
        entries.push(childFields);
      }
    }
    const held = holding.single
      ? (entries[0] ?? null)
      : counted || entries.length > 0
        ? entries
        : null;
    if (held !== null) {
      fields[holding.key] = held;
      found = true;
    }
  }
  return found ? fields : null;
}

function reportFromMatched(
  inventory: Inventory,
  matched: Matched,
  userId: string
): PersonalDataReport {
  const resources: PersonalResourceReport[] = [];
  for (const resource of PRIVACY_RESOURCES) {
    const table = tableOf(resource.table);
    const records: PersonalRecord[] = [];
    for (const record of rowsOf(inventory, table.name)) {
      const fields = personalFields(inventory, matched, table, record, false);
      if (fields !== null) {
        records.push({ id: recordId(record), fields });
      }
    }
    if (records.length > 0) {
      resources.push({ resource: resource.name, records });
    }
  }
  return { userId, resources };
}

export async function buildReportForSeed(
  client: Queryable,
  seed: SubjectSeed
): Promise<PersonalDataReport> {
  const inventory = await takeInventory(client);
  const matched = await seededTargets(client, inventory, seed);
  expandReferenceReach(inventory, matched, seed);
  return reportFromMatched(inventory, matched, seed.userId ?? '');
}

export async function buildAdminReport(
  client: Queryable,
  seed: SubjectSeed
): Promise<PersonalDataReport> {
  const inventory = await takeInventory(client);
  const matched = await seededTargets(client, inventory, seed);
  for (const table of inventory.tables) {
    const ids = matchedIds(matched, table.name);
    for (const record of rowsOf(inventory, table.name)) {
      if (compositeMatches(record, table, seed)) {
        ids.add(recordId(record));
      }
    }
  }
  expandReferenceReach(inventory, matched, seed);
  return reportFromMatched(inventory, matched, seed.userId ?? '');
}

function subjectName(record: Row, table: PrivacyTable): string {
  for (const column of table.columns) {
    if (column.subject && text(record, column.identifier).trim() !== '') {
      return text(record, column.identifier).trim();
    }
  }
  return '';
}

function indexRecord(
  byKey: Map<string, SubjectIndexEntry>,
  record: Row,
  table: PrivacyTable
): void {
  for (const field of table.identityStrong) {
    const raw = text(record, field).trim();
    if (raw !== '' && !byKey.has(raw.toLowerCase())) {
      byKey.set(raw.toLowerCase(), {
        email: raw,
        name: subjectName(record, table),
        attributes: {},
        userId: null,
      });
    }
  }
  if (hasStrongValue(record, table.identityStrong)) {
    return;
  }
  for (const group of table.identityComposite) {
    const attributes = compositeAttributes(record, group);
    if (attributes !== null) {
      const key = `composite:${group.map((field) => (attributes[field] ?? '').toLowerCase()).join('|')}`;
      if (!byKey.has(key)) {
        byKey.set(key, { email: '', name: subjectName(record, table), attributes, userId: null });
      }
    }
  }
}

export async function buildSubjectIndex(client: Queryable): Promise<SubjectIndexEntry[]> {
  const byKey = new Map<string, SubjectIndexEntry>();
  for (const user of await tableRows(client, USER_TABLE)) {
    const email = text(user, 'email').trim();
    if (email !== '') {
      byKey.set(email.toLowerCase(), {
        email,
        name: text(user, 'name'),
        attributes: {},
        userId: typeof user['id'] === 'string' ? user['id'] : null,
      });
    }
  }
  for (const table of recordTables()) {
    if (table.identityStrong.length > 0 || table.identityComposite.length > 0) {
      for (const record of await tableRows(client, table.name)) {
        indexRecord(byKey, record, table);
      }
    }
  }
  return [...byKey.values()];
}

function grantGroups(inventory: Inventory): GrantGroup[] {
  const groups: GrantGroup[] = PRIVACY_RESOURCES.map((resource) => ({
    key: resource.name,
    table: tableOf(resource.table),
  }));
  for (const table of inventory.tables) {
    if (!isResourceTable(table.name)) {
      groups.push({ key: table.name, table });
    }
  }
  return groups;
}

export async function findCompositeCandidates(
  client: Queryable,
  seed: SubjectSeed
): Promise<PersonalResourceReport[]> {
  const inventory = await takeInventory(client);
  const seeded = await seededTargets(client, inventory, seed);
  const candidates: PersonalResourceReport[] = [];
  for (const group of grantGroups(inventory)) {
    const already = idsOf(seeded, group.table.name);
    const records: PersonalRecord[] = [];
    for (const record of rowsOf(inventory, group.table.name)) {
      const id = recordId(record);
      if (!already.has(id) && compositeMatches(record, group.table, seed)) {
        const candidate: Matched = new Map([[group.table.name, new Set([id])]]);
        records.push({
          id,
          fields: personalFields(inventory, candidate, group.table, record, false) ?? {},
        });
      }
    }
    if (records.length > 0) {
      candidates.push({ resource: group.key, records });
    }
  }
  return candidates;
}

function fileColumns(columns: PrivacyColumn[]): PrivacyColumn[] {
  return columns.filter((column) => column.reference === FILE_ELEMENT);
}

function collectHeld(
  inventory: Inventory,
  table: PrivacyTable,
  record: Row,
  personalOnly: boolean,
  files: Set<string>,
  removed: Matched
): void {
  for (const column of fileColumns(personalOnly ? personalColumns(table) : table.columns)) {
    for (const fileId of referencedIds(record, column)) {
      files.add(fileId);
    }
  }
  for (const holding of holdings(inventory, table, record)) {
    if (!personalOnly || holding.personal) {
      for (const child of holding.records) {
        matchedIds(removed, holding.table.name).add(recordId(child));
        collectHeld(inventory, holding.table, child, false, files, removed);
      }
    }
  }
}

function collectErased(
  inventory: Inventory,
  table: PrivacyTable,
  ids: Set<string>,
  personalOnly: boolean,
  files: Set<string>,
  removed: Matched
): void {
  for (const id of ids) {
    const record = findRow(inventory, table.name, id);
    if (record !== null) {
      collectHeld(inventory, table, record, personalOnly, files, removed);
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
  table: PrivacyTable,
  ids: Set<string>
): Promise<void> {
  if (ids.size === 0) {
    return;
  }
  const columns = personalColumns(table);
  const backups = await backupColumnsOf(client, table.name);
  if (columns.length === 0 && backups.length === 0) {
    return;
  }
  const assignments = [
    ...columns.map((column, index) => `${quotedIdentifier(column.identifier)} = $${index + 2}`),
    ...backups.map((column) => `${quotedIdentifier(column)} = NULL`),
  ].join(', ');
  const values = columns.map((column) => column.scrub);
  for (const id of ids) {
    await client.query(`UPDATE "${table.name}" SET ${assignments} WHERE id = $1`, [id, ...values]);
  }
}

async function clearInboundReferences(
  client: Queryable,
  table: string,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  for (const reference of INBOUND_REFERENCES[table] ?? []) {
    await client.query(
      reference.list
        ? `DELETE FROM "${reference.table}" WHERE "${reference.column}" = ANY($1)`
        : `UPDATE "${reference.table}" SET "${reference.column}" = '' WHERE "${reference.column}" = ANY($1)`,
      [ids]
    );
  }
}

async function deleteRows(client: Queryable, table: PrivacyTable, ids: Set<string>): Promise<void> {
  for (const id of ids) {
    await client.query(`DELETE FROM "${table.name}" WHERE id = $1`, [id]);
  }
  await clearInboundReferences(client, table.name, [...ids]);
}

async function removeContainedRecords(
  client: Queryable,
  inventory: Inventory,
  removed: Matched
): Promise<void> {
  for (const table of inventory.tables) {
    const gone = idsOf(removed, table.name);
    for (const record of rowsOf(inventory, table.name)) {
      const id = recordId(record);
      for (const column of table.columns) {
        if (
          column.contained &&
          column.reference !== null &&
          !gone.has(id) &&
          idsOf(removed, column.reference).has(text(record, column.identifier))
        ) {
          await client.query(
            `UPDATE "${table.name}" SET "${column.identifier}" = '' WHERE id = $1`,
            [id]
          );
        }
      }
    }
  }
  for (const [name, ids] of removed) {
    await deleteRows(client, tableOf(name), ids);
  }
}

async function deleteOwnership(client: Queryable, userId: string): Promise<void> {
  for (const resource of PRIVACY_RESOURCES) {
    if (resource.ownershipTable !== null) {
      await client.query(`DELETE FROM "${resource.ownershipTable}" WHERE "userId" = $1`, [userId]);
    }
  }
}

function mergeGranted(inventory: Inventory, matched: Matched, granted: Matched): void {
  for (const group of grantGroups(inventory)) {
    const ids = matchedIds(matched, group.table.name);
    for (const id of granted.get(group.key) ?? []) {
      ids.add(id);
    }
  }
}

function referenceOnlyIds(reached: Set<string>, subjectIds: Set<string>): Set<string> {
  const ids = new Set<string>();
  for (const id of reached) {
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
  const inventory = await takeInventory(client);
  const subject = await seededTargets(client, inventory, seed);
  mergeGranted(inventory, subject, granted);
  const withReach = snapshotMatched(subject);
  expandReferenceReach(inventory, withReach, seed);
  const files = new Set<string>();
  const removed: Matched = new Map();
  for (const table of inventory.tables) {
    const subjectIds = idsOf(subject, table.name);
    collectErased(inventory, table, subjectIds, resolution === 'anonymize', files, removed);
    if (resolution === 'delete' && !isResourceTable(table.name)) {
      for (const id of subjectIds) {
        matchedIds(removed, table.name).add(id);
      }
    }
    const referencing = referenceOnlyIds(idsOf(withReach, table.name), subjectIds);
    collectErased(inventory, table, referencing, true, files, removed);
  }
  await removeContainedRecords(client, inventory, removed);
  for (const table of inventory.tables) {
    const subjectIds = idsOf(subject, table.name);
    if (resolution === 'anonymize') {
      await anonymizeRecords(client, table, subjectIds);
    } else if (isResourceTable(table.name)) {
      await deleteRows(client, table, subjectIds);
    }
    await anonymizeRecords(
      client,
      table,
      referenceOnlyIds(idsOf(withReach, table.name), subjectIds)
    );
  }
  if (resolution === 'delete' && seed.userId !== null && seed.userId !== '') {
    await deleteOwnership(client, seed.userId);
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
