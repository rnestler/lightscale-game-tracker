export function textValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

export function flagValue(value: unknown): boolean {
  return value === true;
}

export function listValue(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => textValue(entry)) : [];
}

export function fileListValue<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function stagedRecord<T>(values: Record<string, unknown>): T {
  return values as T;
}
