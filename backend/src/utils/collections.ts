// Generated with Lightscale AI. This file belongs to the owner of the generated application. See LICENSE.
export interface Keyed<Element, Key> {
  element: Element;
  key: Key;
}

export interface Grouped<Element, Key> {
  key: Key;
  items: Element[];
}

export function userKey(userId: string | null): string {
  return userId ?? '';
}

function isUnset(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonicalValue(record[key])])
    );
  }
  return value;
}

function identityOf(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return `${typeof value}:${String(value)}`;
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const { id } = value as { id?: unknown };
    if (typeof id === 'string') {
      return `id:${id}`;
    }
  }
  return `value:${JSON.stringify(canonicalValue(value))}`;
}

function keyText(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function compareKeys(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right);
  }
  const leftText = keyText(left);
  const rightText = keyText(right);
  if (leftText < rightText) {
    return -1;
  }
  return leftText > rightText ? 1 : 0;
}

function compareIdentity(left: unknown, right: unknown): number {
  if (typeof left === 'object' || typeof right === 'object') {
    return compareKeys(identityOf(left), identityOf(right));
  }
  return compareKeys(left, right);
}

function compareKeyed<Element, Key>(
  left: Keyed<Element, Key>,
  right: Keyed<Element, Key>,
  descending: boolean
): number {
  const leftUnset = isUnset(left.key);
  const rightUnset = isUnset(right.key);
  if (leftUnset !== rightUnset) {
    return leftUnset ? 1 : -1;
  }
  const byKey = leftUnset ? 0 : compareKeys(left.key, right.key);
  if (byKey !== 0) {
    return descending ? -byKey : byKey;
  }
  return compareIdentity(left.element, right.element);
}

export function orderByKey<Element, Key>(
  entries: Array<Keyed<Element, Key>>,
  descending: boolean
): Element[] {
  return [...entries]
    .sort((left, right) => compareKeyed(left, right, descending))
    .map((entry) => entry.element);
}

export function groupByKey<Element, Key>(
  entries: Array<Keyed<Element, Key>>
): Array<Grouped<Element, Key>> {
  const groups = new Map<string, Grouped<Element, Key>>();
  for (const entry of entries) {
    const identity = identityOf(entry.key);
    const group = groups.get(identity);
    if (group === undefined) {
      groups.set(identity, { key: entry.key, items: [entry.element] });
    } else {
      group.items.push(entry.element);
    }
  }
  return [...groups.values()];
}

export function distinctOf<Element>(items: Element[]): Element[] {
  const seen = new Set<string>();
  const result: Element[] = [];
  for (const item of items) {
    const identity = identityOf(item);
    if (!seen.has(identity)) {
      seen.add(identity);
      result.push(item);
    }
  }
  return result;
}

export function containsValue<Element>(items: readonly Element[], value: Element): boolean {
  const identity = identityOf(value);
  return items.some((item) => identityOf(item) === identity);
}

export function includingValue<Element>(items: readonly Element[], value: Element): Element[] {
  return containsValue(items, value) ? [...items] : [...items, value];
}

export function excludingValue<Element>(items: readonly Element[], value: Element): Element[] {
  const identity = identityOf(value);
  return items.filter((item) => identityOf(item) !== identity);
}

export function zipOf<First, Second>(
  first: First[],
  second: Second[]
): Array<{ first: First; second: Second }> {
  const pairs: Array<{ first: First; second: Second }> = [];
  const length = Math.min(first.length, second.length);
  for (let index = 0; index < length; index++) {
    const left = first[index];
    const right = second[index];
    if (left !== undefined && right !== undefined) {
      pairs.push({ first: left, second: right });
    }
  }
  return pairs;
}

export function splitOf(text: string, separator: string): string[] {
  return text === '' ? [] : text.split(separator);
}

export function beforeOf(text: string, separator: string): string {
  const index = text.indexOf(separator);
  return index < 0 ? text : text.slice(0, index);
}

export function afterOf(text: string, separator: string): string {
  const index = text.indexOf(separator);
  return index < 0 ? '' : text.slice(index + separator.length);
}
