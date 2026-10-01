import { UploadRefusedError } from './file-inspection.js';

const UNIQUE_VIOLATION = '23505';
const REFERENCE_VIOLATION = '23503';

interface UniqueRule {
  type: string;
  fields: string[];
}

interface ReferenceRule {
  type: string;
  field: string;
}

const UNIQUE_RULES: Record<string, UniqueRule | undefined> = {
  ux_Player_nickname: {
    type: 'Player',
    fields: ['nickname'],
  },
  ux_Player_emailAddress: {
    type: 'Player',
    fields: ['emailAddress'],
  },
  ux_LeaderboardEntry_playerId_gameId: {
    type: 'LeaderboardEntry',
    fields: ['playerId', 'gameId'],
  },
};

const REFERENCE_RULES: Record<string, ReferenceRule | undefined> = {
  fk_LeaderboardEntry_playerId: {
    type: 'LeaderboardEntry',
    field: 'playerId',
  },
  fk_LeaderboardEntry_gameId: {
    type: 'LeaderboardEntry',
    field: 'gameId',
  },
  fk_Match_gameId: {
    type: 'Match',
    field: 'gameId',
  },
  fk_Match_playerOneId: {
    type: 'Match',
    field: 'playerOneId',
  },
  fk_Match_playerTwoId: {
    type: 'Match',
    field: 'playerTwoId',
  },
};

export interface ErrorRefusal {
  status: number;
  body: Record<string, unknown>;
}

interface Violation {
  code: string;
  constraint: string;
}

function violationOf(error: unknown): Violation | null {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    !('constraint' in error)
  ) {
    return null;
  }
  const { code, constraint } = error;
  return typeof code === 'string' && typeof constraint === 'string' ? { code, constraint } : null;
}

function uniqueRefusal(constraint: string): ErrorRefusal | null {
  const rule = UNIQUE_RULES[constraint];
  if (rule === undefined) {
    return null;
  }
  return {
    status: 409,
    body: {
      error: `A record with this ${rule.fields.join(', ')} already exists on '${rule.type}'`,
      code: 'PRECONDITION_FAILED',
      refusal: { kind: 'unique', type: rule.type, fields: rule.fields },
    },
  };
}

function referenceRefusal(constraint: string): ErrorRefusal | null {
  const rule = REFERENCE_RULES[constraint];
  if (rule === undefined) {
    return null;
  }
  return {
    status: 409,
    body: {
      error: `'${rule.field}' on '${rule.type}' keeps the referenced record in use or points to a record that no longer exists`,
      code: 'REFERENCE_CONFLICT',
      refusal: { kind: 'precondition' },
    },
  };
}

function databaseRefusal(error: unknown): ErrorRefusal | null {
  const violation = violationOf(error);
  if (violation === null) {
    return null;
  }
  if (violation.code === UNIQUE_VIOLATION) {
    return uniqueRefusal(violation.constraint);
  }
  if (violation.code === REFERENCE_VIOLATION) {
    return referenceRefusal(violation.constraint);
  }
  return null;
}

export function errorRefusal(error: unknown): ErrorRefusal | null {
  if (error instanceof UploadRefusedError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  return databaseRefusal(error);
}
