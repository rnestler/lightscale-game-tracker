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

const HIDDEN_COLUMNS_STORAGE_PREFIX = 'lightscale.hiddenColumns.';
const COLUMN_CHOICE_SEPARATOR = '\t';

function storedColumnChoices(key: string): Map<string, boolean> {
  const choices = new Map<string, boolean>();
  if (typeof window === 'undefined') {
    return choices;
  }
  const stored = window.localStorage.getItem(HIDDEN_COLUMNS_STORAGE_PREFIX + key) ?? '';
  for (const line of stored.split('\n')) {
    const separator = line.lastIndexOf(COLUMN_CHOICE_SEPARATOR);
    if (separator > 0) {
      choices.set(line.slice(0, separator), line.slice(separator + 1) === '1');
    }
  }
  return choices;
}

export function getStoredHiddenColumns(
  key: string,
  labels: readonly string[],
  hiddenByDefault: readonly number[]
): Set<number> {
  const choices = storedColumnChoices(key);
  const hidden = new Set<number>();
  for (const [index, label] of labels.entries()) {
    if (choices.get(label) ?? hiddenByDefault.includes(index)) {
      hidden.add(index);
    }
  }
  return hidden;
}

export function setStoredHiddenColumns(
  key: string,
  labels: readonly string[],
  hidden: ReadonlySet<number>
): void {
  if (typeof window === 'undefined') {
    return;
  }
  const lines = labels.map(
    (label, index) => `${label}${COLUMN_CHOICE_SEPARATOR}${hidden.has(index) ? '1' : '0'}`
  );
  window.localStorage.setItem(HIDDEN_COLUMNS_STORAGE_PREFIX + key, lines.join('\n'));
}
