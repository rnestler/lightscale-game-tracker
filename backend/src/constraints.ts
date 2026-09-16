export type Refusal =
  | { kind: 'required'; type: string; field: string; mustBeTrue: boolean }
  | { kind: 'rule'; type: string; fields: string[] }
  | { kind: 'exclusive'; type: string; partition: string[]; interval: string[] }
  | { kind: 'capacity'; type: string; limit: number }
  | { kind: 'stated'; message: string };

function quoteName(name: string): string {
  return `'${name}'`;
}

function refusalSentence(refusal: Refusal): string {
  switch (refusal.kind) {
    case 'stated':
      return refusal.message;
    case 'required':
      return refusal.mustBeTrue
        ? `'${refusal.field}' must be true on '${refusal.type}'; required boolean fields must be checked`
        : `'${refusal.field}' is required on '${refusal.type}'`;
    case 'rule': {
      const named = refusal.fields.map(quoteName).join(', ');
      return refusal.fields.length === 1
        ? `'${refusal.type}' cannot be saved: the value in ${named} is not allowed here`
        : `'${refusal.type}' cannot be saved: the values in ${named} are not allowed together`;
    }
    case 'exclusive':
      return `A record with this ${refusal.partition.join(', ')} already has an overlapping ${refusal.interval.join('/')} on '${refusal.type}'`;
    case 'capacity':
      return `'${refusal.type}' has reached its capacity of ${refusal.limit}`;
  }
}

export class ConstraintViolationError extends Error {
  public readonly refusal: Refusal;

  constructor(refusal: Refusal) {
    super(refusalSentence(refusal));
    this.name = 'ConstraintViolationError';
    this.refusal = refusal;
  }
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

function requireValue(
  candidate: Record<string, unknown>,
  field: string,
  table: string,
  mustBeTrue: boolean
): void {
  if (isEmptyValue(candidate[field])) {
    throw new ConstraintViolationError({ kind: 'required', type: table, field, mustBeTrue });
  }
}

export function enforceGameTypeConstraints(candidate: Record<string, unknown>): void {
  requireValue(candidate, 'name', 'GameType', false);
  requireValue(candidate, 'category', 'GameType', false);
}

export function enforcePlayerConstraints(candidate: Record<string, unknown>): void {
  requireValue(candidate, 'nickname', 'Player', false);
  requireValue(candidate, 'fullName', 'Player', false);
  requireValue(candidate, 'emailAddress', 'Player', false);
}

export function enforceLeaderboardEntryConstraints(candidate: Record<string, unknown>): void {
  requireValue(candidate, 'playerId', 'LeaderboardEntry', false);
  requireValue(candidate, 'gameId', 'LeaderboardEntry', false);
}

export function enforceMatchConstraints(candidate: Record<string, unknown>): void {
  requireValue(candidate, 'gameId', 'Match', false);
  requireValue(candidate, 'playerOneId', 'Match', false);
  requireValue(candidate, 'playerTwoId', 'Match', false);
  requireValue(candidate, 'scheduledAt', 'Match', false);
}
