export interface AvailabilityColumn {
  disclosable: boolean;
}

export interface AvailabilityTable {
  unique: string[][];
  columns: Record<string, AvailabilityColumn | undefined>;
}

export interface AvailabilityRequest {
  rule: string[];
  field: string;
  known: Record<string, unknown>;
  domains: Record<string, string[] | undefined>;
  excludeId: string | null;
}

function isUnset(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function isDomainMap(candidate: unknown): candidate is Record<string, string[]> {
  if (typeof candidate !== 'object' || candidate === null) {
    return false;
  }
  return Object.values(candidate).every(
    (domain) => Array.isArray(domain) && domain.every((value) => typeof value === 'string')
  );
}

export function parseAvailabilityRequest(body: unknown): AvailabilityRequest | string {
  if (typeof body !== 'object' || body === null) {
    return 'Request body must be an object';
  }
  const candidate = body as {
    rule?: unknown;
    field?: unknown;
    known?: unknown;
    domains?: unknown;
    excludeId?: unknown;
  };
  if (
    !Array.isArray(candidate.rule) ||
    !candidate.rule.every((entry) => typeof entry === 'string')
  ) {
    return 'rule must be a list of field names';
  }
  if (typeof candidate.field !== 'string') {
    return 'field must be a field name';
  }
  if (typeof candidate.known !== 'object' || candidate.known === null) {
    return 'known must be an object';
  }
  if (candidate.domains !== undefined && !isDomainMap(candidate.domains)) {
    return 'domains must map field names to value lists';
  }
  if (candidate.excludeId !== undefined && typeof candidate.excludeId !== 'string') {
    return 'excludeId must be a string';
  }
  return {
    rule: candidate.rule,
    field: candidate.field,
    known: candidate.known as Record<string, unknown>,
    domains: isDomainMap(candidate.domains) ? candidate.domains : {},
    excludeId: typeof candidate.excludeId === 'string' ? candidate.excludeId : null,
  };
}

function sameFieldSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((field) => right.includes(field));
}

export function matchDeclaredRule(
  table: AvailabilityTable,
  rule: readonly string[]
): string[] | undefined {
  return table.unique.find((declared) => sameFieldSet(declared, rule));
}

export function isDisclosableField(table: AvailabilityTable, field: string): boolean {
  return table.columns[field]?.disclosable ?? false;
}

function comparable(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

function comparableKey(value: unknown): string {
  return String(comparable(value));
}

export function takenValues(
  table: AvailabilityTable,
  rows: ReadonlyArray<Record<string, unknown>>,
  request: AvailabilityRequest
): unknown[] | string {
  const { rule, field, known, domains, excludeId } = request;
  if (!rule.includes(field)) {
    return 'field must be part of the rule';
  }
  const knownFields = Object.keys(known);
  if (knownFields.includes(field) || knownFields.some((entry) => !rule.includes(entry))) {
    return 'known must cover rule fields other than the queried field';
  }
  const undetermined = rule.filter((entry) => entry !== field && !knownFields.includes(entry));
  let combinations = 1;
  for (const entry of undetermined) {
    const domain: string[] | undefined = domains[entry];
    if (domain === undefined || domain.length === 0) {
      return [];
    }
    combinations *= new Set(domain).size;
  }
  const matching = rows.filter(
    (row) =>
      row['id'] !== excludeId &&
      rule.every((entry) => !isUnset(row[entry])) &&
      knownFields.every((entry) => comparableKey(row[entry]) === comparableKey(known[entry]))
  );
  const combosByValue = new Map<unknown, Set<string>>();
  for (const row of matching) {
    const parts: string[] = [];
    let inDomain = true;
    for (const entry of undetermined) {
      const part = comparableKey(row[entry]);
      if (domains[entry]?.includes(part) !== true) {
        inDomain = false;
      }
      parts.push(part);
    }
    if (inDomain) {
      const value = comparable(row[field]);
      const combos = combosByValue.get(value) ?? new Set<string>();
      combos.add(JSON.stringify(parts));
      combosByValue.set(value, combos);
    }
  }
  const taken: unknown[] = [];
  for (const [value, combos] of combosByValue) {
    if (combos.size >= combinations) {
      taken.push(value);
    }
  }
  return taken;
}
