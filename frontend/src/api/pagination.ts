// Generated with Lightscale AI. This file belongs to the owner of the generated application. See LICENSE.
export const DEFAULT_PAGE_SIZE = 50;

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
  sort: QuerySort | QuerySort[];
  filter: QueryFilter;
  cursor?: string;
}

export interface QueryPage {
  ids: string[];
  nextCursor?: string;
  total?: number;
}

export interface NestedQueryPage<T> {
  items: T[];
  nextCursor?: string;
}

export const MAX_PAGE_LIMIT = 200;

export interface RowPage<Row> {
  rows: Row[];
  nextCursor: string | null;
  total?: number;
}

export function nestedRows<T>(page: NestedQueryPage<T>): RowPage<T> {
  return { rows: page.items, nextCursor: page.nextCursor ?? null };
}

export async function readRows<Row>(
  count: number,
  cursor: string | null,
  read: (limit: number, cursor: string | undefined) => Promise<RowPage<Row>>
): Promise<RowPage<Row>> {
  const rows: Row[] = [];
  let next = cursor;
  let page: RowPage<Row>;
  do {
    page = await read(Math.min(count - rows.length, MAX_PAGE_LIMIT), next ?? undefined);
    rows.push(...page.rows);
    next = page.nextCursor;
  } while (next !== null && page.rows.length > 0 && rows.length < count);
  return { rows, nextCursor: next, total: page.total };
}

export function readStoredValue<T>(
  key: string,
  initial: T,
  accepts: (value: unknown) => value is T
): T {
  if (typeof window === 'undefined') {
    return initial;
  }
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === null) {
      return initial;
    }
    const parsed: unknown = JSON.parse(stored);
    return accepts(parsed) ? parsed : initial;
  } catch {
    return initial;
  }
}

export function writeStoredValue(key: string, value: unknown): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Empty by design */
  }
}

export function isStoredString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isStoredNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isStoredBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isStoredMember(members: readonly string[]): (value: unknown) => value is string {
  return (value: unknown): value is string => typeof value === 'string' && members.includes(value);
}

const HIDDEN_COLUMNS_STORAGE_PREFIX = 'lightscale.hiddenColumns.';

function isColumnChoices(value: unknown): value is Record<string, boolean> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every((choice) => typeof choice === 'boolean')
  );
}

export function getStoredHiddenColumns(
  key: string,
  labels: readonly string[],
  hiddenByDefault: readonly number[]
): Set<number> {
  const choices = readStoredValue<Record<string, boolean>>(
    HIDDEN_COLUMNS_STORAGE_PREFIX + key,
    {},
    isColumnChoices
  );
  const hidden = new Set<number>();
  for (const [index, label] of labels.entries()) {
    if (choices[label] ?? hiddenByDefault.includes(index)) {
      hidden.add(index);
    }
  }
  return hidden;
}

export function isLastShownColumn(
  hidden: ReadonlySet<number>,
  readable: readonly boolean[],
  index: number
): boolean {
  if (hidden.has(index) || !readable[index]) {
    return false;
  }
  return readable.filter((canRead, position) => canRead && !hidden.has(position)).length <= 1;
}

export function setStoredHiddenColumns(
  key: string,
  labels: readonly string[],
  hidden: ReadonlySet<number>
): void {
  const choices: Record<string, boolean> = {};
  for (const [index, label] of labels.entries()) {
    choices[label] = hidden.has(index);
  }
  writeStoredValue(HIDDEN_COLUMNS_STORAGE_PREFIX + key, choices);
}
