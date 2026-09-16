import { Buffer } from 'node:buffer';

export interface QuerySort {
  field: string;
  direction: 'ascending' | 'descending';
}

export interface QueryFilter {
  search: string;
  fields: string[];
}

export interface QueryRequest {
  limit: number;
  sort: QuerySort[];
  filter: QueryFilter;
  cursor?: string;
}

export interface PageSource {
  select: string;
  from: string;
  where: string[];
  values: unknown[];
  sortColumns: Record<string, string | undefined>;
  searchColumns: Record<string, string | undefined>;
  keyColumn: string;
  derivedFields?: string[];
  numericFields?: string[];
}

export interface PageQuery {
  text: string;
  values: unknown[];
}

type Row = Record<string, unknown>;

interface PageCursor {
  sortValues: Array<string | number | boolean | null>;
  id: string;
}

const MAX_PAGE_LIMIT = 200;
const MAX_DERIVED_SORT_ROWS = 1000;

class DerivedSortRefusal extends Error {
  public readonly status = 422;
  public readonly code = 'DERIVED_SORT_LIMIT';

  constructor() {
    super(`Sorting by a calculated field is available for up to ${MAX_DERIVED_SORT_ROWS} records`);
  }
}
const SORT_VALUE_ALIAS = '_sortValue';

function parseCursorJson(encoded: string): unknown {
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function decodeCursor(encoded: string): PageCursor | null {
  const parsed = parseCursorJson(encoded);
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  const { id } = record;
  const sortValues: unknown = record.sortValues ?? [record.sortValue];
  if (typeof id !== 'string') {
    return null;
  }
  if (
    !Array.isArray(sortValues) ||
    sortValues.length === 0 ||
    !sortValues.every(
      (value: unknown) =>
        value === null ||
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))
    )
  ) {
    return null;
  }
  return { id, sortValues: sortValues as PageCursor['sortValues'] };
}

export function parseQueryRequest(raw: unknown): QueryRequest | string {
  if (typeof raw !== 'object' || raw === null) {
    return 'Request body must be an object';
  }
  const body = raw as Record<string, unknown>;
  const { limit, sort, filter, cursor } = body;
  if (
    typeof limit !== 'number' ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_PAGE_LIMIT
  ) {
    return `limit must be an integer between 1 and ${MAX_PAGE_LIMIT}`;
  }
  const keys: unknown[] = Array.isArray(sort) ? sort : [sort];
  const order: QuerySort[] = [];
  if (keys.length === 0) {
    return 'sort must contain at least one key';
  }
  for (const key of keys) {
    if (typeof key !== 'object' || key === null) {
      return 'sort must contain objects with field and direction';
    }
    const { field, direction } = key as Record<string, unknown>;
    if (typeof field !== 'string' || field === '') {
      return 'sort.field must be a non-empty string';
    }
    if (direction !== 'ascending' && direction !== 'descending') {
      return "sort.direction must be 'ascending' or 'descending'";
    }
    order.push({ field, direction });
  }
  let search = '';
  let fields: string[] = [];
  if (filter !== undefined) {
    if (typeof filter !== 'object' || filter === null) {
      return 'filter must be an object with search and fields';
    }
    const filterRecord = filter as Record<string, unknown>;
    const { search: searchCandidate, fields: fieldsCandidate } = filterRecord;
    if (typeof searchCandidate !== 'string') {
      return 'filter.search must be a string';
    }
    if (
      !Array.isArray(fieldsCandidate) ||
      !fieldsCandidate.every((entry): entry is string => typeof entry === 'string')
    ) {
      return 'filter.fields must be an array of strings';
    }
    search = searchCandidate;
    fields = fieldsCandidate;
  }
  const request: QueryRequest = { limit, sort: order, filter: { search, fields } };
  if (cursor !== undefined) {
    if (typeof cursor !== 'string' || decodeCursor(cursor)?.sortValues.length !== order.length) {
      return 'cursor must be a valid page cursor';
    }
    request.cursor = cursor;
  }
  return request;
}

function scalarValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return JSON.stringify(value);
}

function encodeCursor(cursor: PageCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}

function searchPredicate(
  source: PageSource,
  request: QueryRequest,
  values: unknown[]
): string | null {
  if (request.filter.search === '' || request.filter.fields.length === 0) {
    return null;
  }
  const columns: string[] = [];
  for (const field of request.filter.fields) {
    const column = source.searchColumns[field];
    if (column !== undefined) {
      columns.push(column);
    }
  }
  if (columns.length === 0) {
    return 'FALSE';
  }
  values.push(likePattern(request.filter.search));
  const parameter = `$${values.length}`;
  const comparisons = columns.map((column) => `${column} ILIKE ${parameter}`);
  return `(${comparisons.join(' OR ')})`;
}

function cursorPredicate(
  source: PageSource,
  request: QueryRequest,
  cursor: PageCursor,
  values: unknown[]
): string {
  const equal: string[] = [];
  const alternatives: string[] = [];
  const keys = [...request.sort, { field: 'id', direction: request.sort[0].direction }];
  const expressions = [
    ...request.sort.map((key) => source.sortColumns[key.field]),
    source.keyColumn,
  ];
  const sortValues = [...cursor.sortValues, cursor.id];
  for (const [index, key] of keys.entries()) {
    const expression = expressions[index];
    const value = sortValues[index];
    const ascending = key.direction === 'ascending';
    values.push(value);
    const parameter = `$${values.length}`;
    const after =
      value === null
        ? ascending
          ? `${expression} IS NOT NULL`
          : 'FALSE'
        : ascending
          ? `${expression} > ${parameter}`
          : `(${expression} IS NULL OR ${expression} < ${parameter})`;
    alternatives.push(`(${[...equal, after].join(' AND ')})`);
    equal.push(`${expression} IS NOT DISTINCT FROM ${parameter}`);
  }
  return `(${alternatives.join(' OR ')})`;
}

export function queryFieldRestriction(
  request: QueryRequest,
  readable: Set<string> | null
): string | null {
  if (readable === null) {
    return null;
  }
  for (const field of [...request.sort.map((key) => key.field), ...request.filter.fields]) {
    if (field !== 'id' && !readable.has(field)) {
      return `Field '${field}' is not readable for this role`;
    }
  }
  return null;
}

export function buildPageQuery(source: PageSource, request: QueryRequest): PageQuery {
  const values = [...source.values];
  const predicates = [...source.where];
  for (const key of request.sort) {
    if (
      source.sortColumns[key.field] === undefined &&
      !(source.derivedFields ?? []).includes(key.field)
    ) {
      throw new Error(`Unknown or non-sortable field: ${key.field}`);
    }
  }
  const computed = request.sort.some((key) => (source.derivedFields ?? []).includes(key.field));
  const search = searchPredicate(source, request, values);
  if (search !== null) {
    predicates.push(search);
  }
  if (request.cursor !== undefined && !computed) {
    const cursor = decodeCursor(request.cursor);
    if (cursor === null) {
      throw new Error('Invalid page cursor');
    }
    predicates.push(cursorPredicate(source, request, cursor, values));
  }
  const whereClause = predicates.length === 0 ? '' : ` WHERE ${predicates.join(' AND ')}`;
  if (computed) {
    values.push(MAX_DERIVED_SORT_ROWS + 1);
    return {
      text: `SELECT ${source.select} FROM ${source.from}${whereClause} LIMIT $${values.length}`,
      values,
    };
  }
  const selections = request.sort.map(
    (key, index) => `${source.sortColumns[key.field]} AS "${SORT_VALUE_ALIAS}${index}"`
  );
  const order = request.sort.map(
    (key) =>
      `${source.sortColumns[key.field]}${key.direction === 'ascending' ? ' ASC NULLS FIRST' : ' DESC NULLS LAST'}`
  );
  order.push(`${source.keyColumn}${request.sort[0].direction === 'ascending' ? ' ASC' : ' DESC'}`);
  values.push(request.limit + 1);
  const text =
    `SELECT ${source.select}, ${selections.join(', ')} FROM ${source.from}${whereClause}` +
    ` ORDER BY ${order.join(', ')} LIMIT $${values.length}`;
  return { text, values };
}

export function buildCountQuery(source: PageSource, request: QueryRequest): PageQuery {
  const values = [...source.values];
  const predicates = [...source.where];
  const search = searchPredicate(source, request, values);
  if (search !== null) {
    predicates.push(search);
  }
  const whereClause = predicates.length === 0 ? '' : ` WHERE ${predicates.join(' AND ')}`;
  return { text: `SELECT COUNT(*) AS "total" FROM ${source.from}${whereClause}`, values };
}

export function pageResult(
  rows: Row[],
  request: QueryRequest,
  primaryKey: string
): { page: Row[]; nextCursor: string | null } {
  const hasMore = rows.length > request.limit;
  const page = hasMore ? rows.slice(0, request.limit) : rows;
  let nextCursor: string | null = null;
  if (hasMore) {
    const last = page[page.length - 1];
    nextCursor = encodeCursor({
      sortValues: request.sort.map((_, index) => scalarValue(last[SORT_VALUE_ALIAS + index])),
      id: String(last[primaryKey]),
    });
  }
  for (const row of page) {
    for (const [index] of request.sort.entries()) {
      delete row[SORT_VALUE_ALIAS + index];
    }
  }
  return { page, nextCursor };
}

function compareValues(
  left: string | number | boolean | null,
  right: string | number | boolean | null
): number {
  if (left === null) {
    return right === null ? 0 : -1;
  }
  if (right === null) {
    return 1;
  }
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right);
  }
  return String(left).localeCompare(String(right));
}

function compareRow(
  row: Row,
  values: PageCursor['sortValues'],
  id: string,
  request: QueryRequest,
  source: PageSource
): number {
  for (const [index, key] of request.sort.entries()) {
    const left = scalarValue(row[key.field]);
    const right = values[index];
    const numeric = (source.numericFields ?? []).includes(key.field);
    const compared = compareValues(
      numeric && left !== null ? Number(left) : left,
      numeric && right !== null ? Number(right) : right
    );
    if (compared !== 0) {
      return key.direction === 'ascending' ? compared : -compared;
    }
  }
  const compared = String(row.id).localeCompare(id);
  return request.sort[0].direction === 'ascending' ? compared : -compared;
}

export async function readPageRows(
  source: PageSource,
  request: QueryRequest,
  query: (query: PageQuery) => Promise<Row[]>,
  compute: ((rows: Row[]) => Promise<Row[]>) | null
): Promise<Row[]> {
  const rows = await query(buildPageQuery(source, request));
  if (!request.sort.some((key) => (source.derivedFields ?? []).includes(key.field))) {
    return rows;
  }
  if (compute === null) {
    throw new Error('Derived sort has no evaluator');
  }
  if (rows.length > MAX_DERIVED_SORT_ROWS) {
    throw new DerivedSortRefusal();
  }
  const computed = await compute(rows);
  computed.sort((left, right) =>
    compareRow(
      left,
      request.sort.map((key) => scalarValue(right[key.field])),
      String(right.id),
      request,
      source
    )
  );
  const cursor = request.cursor === undefined ? null : decodeCursor(request.cursor);
  const following =
    cursor === null
      ? computed
      : computed.filter(
          (row) => compareRow(row, cursor.sortValues, cursor.id, request, source) > 0
        );
  const page = following.slice(0, request.limit + 1);
  for (const row of page) {
    for (const [index, key] of request.sort.entries()) {
      row[SORT_VALUE_ALIAS + index] = row[key.field];
    }
  }
  return page;
}
