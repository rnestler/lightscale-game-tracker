import type { Queryable } from './db.js';
import { localize, type LocalizedText } from './utils/language.js';

export type RuleViolationKind = 'unique' | 'exclusive' | 'check' | 'required' | 'capacity';

interface CommonRule {
  table: string;
  label: string;
  kind: RuleViolationKind;
  identity: string;
  message: LocalizedText;
  fields: string[];
  ruleFields: string[];
}

interface UniqueRule extends CommonRule {
  columns: string[];
}

interface ExclusiveRule extends CommonRule {
  partition: string[];
  interval: [string, string];
  numeric: boolean;
}

interface PredicateRule extends CommonRule {
  holds: (client: Queryable, row: Record<string, unknown>) => Promise<boolean>;
}

interface RequiredRule extends CommonRule {
  column: string;
  appliesWhen: ((client: Queryable, row: Record<string, unknown>) => Promise<boolean>) | null;
}

interface CapacityRule extends CommonRule {
  limit: number;
}

export interface TableRules {
  unique: UniqueRule[];
  exclusive: ExclusiveRule[];
  check: PredicateRule[];
  required: RequiredRule[];
  capacity: CapacityRule | null;
  derive:
    | ((
        client: Queryable,
        rows: Array<Record<string, unknown>>
      ) => Promise<Array<Record<string, unknown>>>)
    | null;
  version: string;
}

const RULE_TABLES = new Map<string, TableRules>([
  [
    'GameType',
    {
      unique: [],
      exclusive: [],
      check: [],
      required: [
        {
          table: 'GameType',
          label: 'games',
          kind: 'required',
          identity: 'GameType|required|name|0',
          message: '',
          fields: ['name'],
          ruleFields: ['name'],
          column: 'name',
          appliesWhen: null,
        },
        {
          table: 'GameType',
          label: 'games',
          kind: 'required',
          identity: 'GameType|required|category|1',
          message: '',
          fields: ['category'],
          ruleFields: ['category'],
          column: 'category',
          appliesWhen: null,
        },
      ],
      capacity: null,
      derive: null,
      version: '8da3298ce73605a1',
    },
  ],
  [
    'Player',
    {
      unique: [
        {
          table: 'Player',
          label: 'players',
          kind: 'unique',
          identity: 'Player|unique|nickname|0',
          message: '',
          fields: ['nickname'],
          ruleFields: ['nickname'],
          columns: ['nickname'],
        },
        {
          table: 'Player',
          label: 'players',
          kind: 'unique',
          identity: 'Player|unique|emailAddress|1',
          message: '',
          fields: ['emailAddress'],
          ruleFields: ['emailAddress'],
          columns: ['emailAddress'],
        },
      ],
      exclusive: [],
      check: [],
      required: [
        {
          table: 'Player',
          label: 'players',
          kind: 'required',
          identity: 'Player|required|nickname|0',
          message: '',
          fields: ['nickname'],
          ruleFields: ['nickname'],
          column: 'nickname',
          appliesWhen: null,
        },
        {
          table: 'Player',
          label: 'players',
          kind: 'required',
          identity: 'Player|required|fullName|1',
          message: '',
          fields: ['fullName'],
          ruleFields: ['fullName'],
          column: 'fullName',
          appliesWhen: null,
        },
        {
          table: 'Player',
          label: 'players',
          kind: 'required',
          identity: 'Player|required|emailAddress|2',
          message: '',
          fields: ['emailAddress'],
          ruleFields: ['emailAddress'],
          column: 'emailAddress',
          appliesWhen: null,
        },
      ],
      capacity: null,
      derive: null,
      version: '08924c7e444407dc',
    },
  ],
  [
    'LeaderboardEntry',
    {
      unique: [
        {
          table: 'LeaderboardEntry',
          label: 'leaderboards',
          kind: 'unique',
          identity: 'LeaderboardEntry|unique|gameId,playerId|0',
          message: '',
          fields: ['playerId', 'gameId'],
          ruleFields: ['playerId', 'gameId'],
          columns: ['playerId', 'gameId'],
        },
      ],
      exclusive: [],
      check: [],
      required: [
        {
          table: 'LeaderboardEntry',
          label: 'leaderboards',
          kind: 'required',
          identity: 'LeaderboardEntry|required|playerId|0',
          message: '',
          fields: ['playerId'],
          ruleFields: ['playerId'],
          column: 'playerId',
          appliesWhen: null,
        },
        {
          table: 'LeaderboardEntry',
          label: 'leaderboards',
          kind: 'required',
          identity: 'LeaderboardEntry|required|gameId|1',
          message: '',
          fields: ['gameId'],
          ruleFields: ['gameId'],
          column: 'gameId',
          appliesWhen: null,
        },
      ],
      capacity: null,
      derive: null,
      version: 'fe545b4272735c5f',
    },
  ],
  [
    'Match',
    {
      unique: [],
      exclusive: [],
      check: [],
      required: [
        {
          table: 'Match',
          label: 'matches',
          kind: 'required',
          identity: 'Match|required|gameId|0',
          message: '',
          fields: ['gameId'],
          ruleFields: ['gameId'],
          column: 'gameId',
          appliesWhen: null,
        },
        {
          table: 'Match',
          label: 'matches',
          kind: 'required',
          identity: 'Match|required|playerOneId|1',
          message: '',
          fields: ['playerOneId'],
          ruleFields: ['playerOneId'],
          column: 'playerOneId',
          appliesWhen: null,
        },
        {
          table: 'Match',
          label: 'matches',
          kind: 'required',
          identity: 'Match|required|playerTwoId|2',
          message: '',
          fields: ['playerTwoId'],
          ruleFields: ['playerTwoId'],
          column: 'playerTwoId',
          appliesWhen: null,
        },
        {
          table: 'Match',
          label: 'matches',
          kind: 'required',
          identity: 'Match|required|scheduledAt|3',
          message: '',
          fields: ['scheduledAt'],
          ruleFields: ['scheduledAt'],
          column: 'scheduledAt',
          appliesWhen: null,
        },
      ],
      capacity: null,
      derive: null,
      version: 'a5c6ec919b7bc340',
    },
  ],
]);

type Row = Record<string, unknown>;

const ALL_KINDS: readonly RuleViolationKind[] = [
  'unique',
  'exclusive',
  'check',
  'required',
  'capacity',
];

const KINDS_BEFORE_STORED_ROW_SCAN: readonly RuleViolationKind[] = ['unique', 'exclusive', 'check'];

export interface ShownRuleViolationGroup {
  table: string;
  label: string;
  kind: RuleViolationKind;
  identity: string;
  message: string;
  fields: string[];
  count: number;
  limit: number;
}

export interface RuleViolationRow {
  id: string;
  groups: number[];
}

export interface RuleViolationRows {
  groups: ShownRuleViolationGroup[];
  rows: RuleViolationRow[];
  ruleSetVersion: string;
}

interface ScannedGroup {
  rule: CommonRule;
  limit: number;
  count: number;
  ids: string[];
}

export function renderableKinds(announced: unknown): RuleViolationKind[] {
  if (typeof announced !== 'string') {
    return [...KINDS_BEFORE_STORED_ROW_SCAN];
  }
  const wanted = announced.split(',');
  return ALL_KINDS.filter((kind) => wanted.includes(kind));
}

function isUnset(value: unknown): boolean {
  return value === undefined || value === null || value === '';
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

async function tableRows(client: Queryable, table: string, rules: TableRules): Promise<Row[]> {
  const { rows } = await client.query<Row>(`SELECT * FROM "${table}"`);
  return rules.derive === null ? rows : rules.derive(client, rows);
}

function duplicateIds(rows: Row[], columns: string[]): string[] {
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    if (columns.every((column) => !isUnset(row[column]))) {
      const key = JSON.stringify(columns.map((column) => row[column]));
      const ids = groups.get(key) ?? [];
      ids.push(String(row['id']));
      groups.set(key, ids);
    }
  }
  const flagged: string[] = [];
  for (const ids of groups.values()) {
    if (ids.length > 1) {
      flagged.push(...ids);
    }
  }
  return flagged;
}

function ordinal(value: unknown, numeric: boolean): number | null {
  if (isUnset(value)) {
    return null;
  }
  if (numeric) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const clock = /^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/.test(value);
  const instant = new Date(clock ? `1970-01-01T${value}Z` : value).getTime();
  return Number.isNaN(instant) ? null : instant;
}

function intervalOf(row: Row, rule: ExclusiveRule): [number, number] | null {
  const start = ordinal(row[rule.interval[0]], rule.numeric);
  const end = ordinal(row[rule.interval[1]], rule.numeric);
  if (start === null) {
    return end === null ? null : [end, end];
  }
  if (end === null || end <= start) {
    return [start, start];
  }
  return [start, end];
}

function sharesPartition(left: Row, right: Row, partition: string[]): boolean {
  return partition.every((field) => !isUnset(left[field]) && left[field] === right[field]);
}

function overlappingIds(rows: Row[], rule: ExclusiveRule): string[] {
  const flagged = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const own = intervalOf(row, rule);
    if (own !== null) {
      for (const other of rows.slice(index + 1)) {
        const otherInterval = sharesPartition(row, other, rule.partition)
          ? intervalOf(other, rule)
          : null;
        if (otherInterval !== null && own[0] < otherInterval[1] && otherInterval[0] < own[1]) {
          flagged.add(String(row['id']));
          flagged.add(String(other['id']));
        }
      }
    }
  }
  return [...flagged];
}

async function failingIds(client: Queryable, rows: Row[], rule: PredicateRule): Promise<string[]> {
  const flagged: string[] = [];
  for (const row of rows) {
    if (rule.fields.every((field) => !isUnset(row[field])) && !(await rule.holds(client, row))) {
      flagged.push(String(row['id']));
    }
  }
  return flagged;
}

async function unmetIds(client: Queryable, rows: Row[], rule: RequiredRule): Promise<string[]> {
  const flagged: string[] = [];
  for (const row of rows) {
    const applies = rule.appliesWhen === null || (await rule.appliesWhen(client, row));
    if (applies && isEmptyValue(row[rule.column])) {
      flagged.push(String(row['id']));
    }
  }
  return flagged;
}

async function scanRows(
  client: Queryable,
  rules: TableRules,
  rows: Row[],
  kinds: readonly RuleViolationKind[]
): Promise<ScannedGroup[]> {
  const scanned: ScannedGroup[] = [];
  if (kinds.includes('unique')) {
    for (const rule of rules.unique) {
      const ids = duplicateIds(rows, rule.columns);
      if (ids.length > 0) {
        scanned.push({ rule, limit: 0, count: ids.length, ids });
      }
    }
  }
  if (kinds.includes('exclusive')) {
    for (const rule of rules.exclusive) {
      const ids = overlappingIds(rows, rule);
      if (ids.length > 0) {
        scanned.push({ rule, limit: 0, count: ids.length, ids });
      }
    }
  }
  if (kinds.includes('check')) {
    for (const rule of rules.check) {
      const ids = await failingIds(client, rows, rule);
      if (ids.length > 0) {
        scanned.push({ rule, limit: 0, count: ids.length, ids });
      }
    }
  }
  if (kinds.includes('required')) {
    for (const rule of rules.required) {
      const ids = await unmetIds(client, rows, rule);
      if (ids.length > 0) {
        scanned.push({ rule, limit: 0, count: ids.length, ids });
      }
    }
  }
  const { capacity } = rules;
  if (kinds.includes('capacity') && capacity !== null && rows.length > capacity.limit) {
    scanned.push({ rule: capacity, limit: capacity.limit, count: rows.length, ids: [] });
  }
  return scanned;
}

function shownGroup(entry: ScannedGroup, count: number): ShownRuleViolationGroup {
  return {
    table: entry.rule.table,
    label: entry.rule.label,
    kind: entry.rule.kind,
    identity: entry.rule.identity,
    message: localize(entry.rule.message),
    fields: entry.rule.fields,
    count,
    limit: entry.limit,
  };
}

export async function collectRuleViolations(
  client: Queryable,
  kinds: readonly RuleViolationKind[]
): Promise<ShownRuleViolationGroup[]> {
  const groups: ShownRuleViolationGroup[] = [];
  for (const [table, rules] of RULE_TABLES) {
    for (const entry of await scanRows(
      client,
      rules,
      await tableRows(client, table, rules),
      kinds
    )) {
      groups.push(shownGroup(entry, entry.count));
    }
  }
  return groups;
}

function fieldsAreReadable(rule: CommonRule, readableFields: ReadonlySet<string> | null): boolean {
  if (readableFields === null || rule.kind === 'capacity') {
    return true;
  }
  if (rule.ruleFields.length === 0) {
    return false;
  }
  return rule.ruleFields.every((field) => readableFields.has(field));
}

function reportedCount(entry: ScannedGroup, visible: number, wholeTable: boolean): number | null {
  switch (entry.rule.kind) {
    case 'unique':
    case 'exclusive':
      return visible >= 2 ? visible : null;
    case 'check':
    case 'required':
      return visible >= 1 ? visible : null;
    case 'capacity':
      return wholeTable ? entry.count : null;
    default:
      throw new Error(`Unknown rule violation kind '${String(entry.rule.kind)}'`);
  }
}

function readableIds(
  entry: ScannedGroup,
  visibleColumns: ReadonlyMap<string, ReadonlySet<string> | null>
): string[] {
  const readable: string[] = [];
  for (const id of entry.ids) {
    const columns = visibleColumns.get(id);
    if (columns !== undefined && fieldsAreReadable(entry.rule, columns)) {
      readable.push(id);
    }
  }
  return readable;
}

export async function collectVisibleRuleViolations(
  client: Queryable,
  table: string,
  visibleColumns: ReadonlyMap<string, ReadonlySet<string> | null>
): Promise<RuleViolationRows> {
  const rules = RULE_TABLES.get(table);
  if (rules === undefined) {
    return { groups: [], rows: [], ruleSetVersion: '' };
  }
  const stored = await tableRows(client, table, rules);
  const scanned = await scanRows(client, rules, stored, ALL_KINDS);
  const seen = stored.filter((row) => visibleColumns.has(String(row['id']))).length;
  const wholeTable = seen === stored.length;
  const groups: ShownRuleViolationGroup[] = [];
  const marked = new Map<string, number[]>();
  for (const entry of scanned) {
    const visible = readableIds(entry, visibleColumns);
    const reported = reportedCount(entry, visible.length, wholeTable);
    if (reported !== null) {
      const index = groups.length;
      groups.push(shownGroup(entry, reported));
      for (const id of visible) {
        marked.set(id, [...(marked.get(id) ?? []), index]);
      }
    }
  }
  const rows: RuleViolationRow[] = [];
  for (const [id, indexes] of marked) {
    rows.push({ id, groups: indexes });
  }
  return { groups, rows, ruleSetVersion: rules.version };
}
