export interface PermissionScope {
  all: string[];
  own: string[];
}

export interface PermissionEntry {
  individual: boolean;
  uncreatable?: boolean;
  read?: PermissionScope;
  create?: PermissionScope;
  update?: PermissionScope;
  delete?: PermissionScope;
  call?: Record<string, PermissionScope>;
}

export const RESOURCE_PERMISSIONS: Record<string, PermissionEntry | undefined> = {
  games: {
    individual: false,
    read: { all: ['player', 'scorekeeper'], own: [] },
    create: { all: ['scorekeeper'], own: [] },
    update: { all: ['scorekeeper'], own: [] },
    delete: { all: [], own: [] },
  },
  players: {
    individual: false,
    read: { all: ['player', 'scorekeeper'], own: [] },
    create: { all: ['scorekeeper'], own: [] },
    update: { all: ['scorekeeper'], own: [] },
    delete: { all: [], own: [] },
  },
  matches: {
    individual: false,
    read: { all: ['player', 'scorekeeper'], own: [] },
    create: { all: ['scorekeeper'], own: ['player'] },
    update: { all: ['scorekeeper'], own: ['player'] },
    delete: { all: ['scorekeeper'], own: [] },
    call: {
      startMatch: { all: ['scorekeeper'], own: ['player'] },
      disputeMatch: { all: ['scorekeeper'], own: ['player'] },
      cancelMatch: { all: ['scorekeeper'], own: ['player'] },
      completeMatch: { all: ['scorekeeper'], own: ['player'] },
    },
  },
  leaderboards: {
    individual: false,
    read: { all: ['player', 'scorekeeper'], own: [] },
    create: { all: ['scorekeeper'], own: [] },
    update: { all: ['scorekeeper'], own: [] },
    delete: { all: [], own: [] },
  },
};

export type SqlPredicate = (alias: string, user: string) => string;

export interface RowGrant {
  role: string;
  scope: 'all' | 'own';
  fields: string[] | null;
  where: Record<string, string | boolean> | null;
  owner: SqlPredicate | null;
}

export interface RowParent {
  path: string;
  table: string;
  source: (alias: string) => string;
  key: (alias: string) => string;
}

export interface RowPolicy {
  table: string;
  individual: boolean;
  parent: RowParent | null;
  membership: SqlPredicate | null;
  read: RowGrant[];
  create: RowGrant[];
  update: RowGrant[];
  delete: RowGrant[];
}

export const ROW_POLICIES: Record<string, RowPolicy | undefined> = {
  games: {
    table: 'GameType',
    individual: false,
    parent: null,
    membership: (alias, user) =>
      `EXISTS (SELECT 1 FROM "creator_games" c WHERE c."gameTypeId" = ${alias}.id AND c."userId" = ${user})`,
    read: [
      { role: 'player', scope: 'all', fields: null, where: null, owner: null },
      { role: 'scorekeeper', scope: 'all', fields: null, where: null, owner: null },
    ],
    create: [{ role: 'scorekeeper', scope: 'all', fields: null, where: null, owner: null }],
    update: [{ role: 'scorekeeper', scope: 'all', fields: null, where: null, owner: null }],
    delete: [],
  },
  players: {
    table: 'Player',
    individual: false,
    parent: null,
    membership: (alias, user) =>
      `EXISTS (SELECT 1 FROM "creator_players" c WHERE c."playerId" = ${alias}.id AND c."userId" = ${user})`,
    read: [
      { role: 'player', scope: 'all', fields: null, where: null, owner: null },
      { role: 'scorekeeper', scope: 'all', fields: null, where: null, owner: null },
    ],
    create: [{ role: 'scorekeeper', scope: 'all', fields: null, where: null, owner: null }],
    update: [{ role: 'scorekeeper', scope: 'all', fields: null, where: null, owner: null }],
    delete: [],
  },
  matches: {
    table: 'Match',
    individual: false,
    parent: null,
    membership: (alias, user) =>
      `EXISTS (SELECT 1 FROM "creator_matches" c WHERE c."matchId" = ${alias}.id AND c."userId" = ${user})`,
    read: [
      { role: 'player', scope: 'all', fields: null, where: null, owner: null },
      { role: 'scorekeeper', scope: 'all', fields: null, where: null, owner: null },
    ],
    create: [
      { role: 'player', scope: 'own', fields: null, where: null, owner: null },
      { role: 'scorekeeper', scope: 'all', fields: null, where: null, owner: null },
    ],
    update: [
      { role: 'player', scope: 'own', fields: null, where: null, owner: null },
      { role: 'scorekeeper', scope: 'all', fields: null, where: null, owner: null },
    ],
    delete: [{ role: 'scorekeeper', scope: 'all', fields: null, where: null, owner: null }],
  },
  leaderboards: {
    table: 'LeaderboardEntry',
    individual: false,
    parent: null,
    membership: (alias, user) =>
      `EXISTS (SELECT 1 FROM "creator_leaderboards" c WHERE c."leaderboardEntryId" = ${alias}.id AND c."userId" = ${user})`,
    read: [
      { role: 'player', scope: 'all', fields: null, where: null, owner: null },
      { role: 'scorekeeper', scope: 'all', fields: null, where: null, owner: null },
    ],
    create: [{ role: 'scorekeeper', scope: 'all', fields: null, where: null, owner: null }],
    update: [{ role: 'scorekeeper', scope: 'all', fields: null, where: null, owner: null }],
    delete: [],
  },
};

export interface IndividualMembership {
  table: string;
  column: string;
}

export const INDIVIDUAL_MEMBERSHIPS: Record<string, IndividualMembership[] | undefined> = {};

export const MANAGEMENT_ROLES: string[] = ['player', 'scorekeeper'];

export const TRANSACTION_CALL_ROLES: Record<string, string[]> = {
  startMatch: ['player', 'scorekeeper'],
  disputeMatch: ['player', 'scorekeeper'],
  cancelMatch: ['player', 'scorekeeper'],
  completeMatch: ['player', 'scorekeeper'],
};
