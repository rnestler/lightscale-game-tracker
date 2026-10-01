type Row = Record<string, unknown>;

export interface AssignedColumns {
  clause: string;
  values: unknown[];
}

export function assignedColumns(columns: Array<[string, unknown]>): AssignedColumns {
  const assignments: string[] = [];
  const values: unknown[] = [];
  for (const [column, value] of columns) {
    if (value !== undefined) {
      values.push(value);
      assignments.push(`"${column}" = $${values.length}`);
    }
  }
  return { clause: assignments.length === 0 ? 'id = id' : assignments.join(', '), values };
}

function candidateValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value === null ? '' : value;
}

export function mergedCandidate(stored: Row, body: Row): Row {
  const candidate: Row = {};
  for (const [key, value] of Object.entries({ ...stored, ...body })) {
    candidate[key] = candidateValue(value);
  }
  return candidate;
}

export function storedTemporal(value: string | undefined): string | null | undefined {
  return value === '' ? null : value;
}
