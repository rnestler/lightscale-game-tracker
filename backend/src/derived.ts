import type { Queryable } from './db.js';

type StepBudget = (count?: number) => void;
type Derivations = Map<string, Record<string, unknown>>;

function createStepBudget(): StepBudget {
  let __steps = 0;
  const __budget = (count = 1): void => {
    __steps = __steps + count;
    if (__steps > 100000) {
      throw new Error('Transaction step budget exceeded');
    }
  };
  return __budget;
}

async function referencedRow(
  client: Queryable,
  derivations: Derivations,
  table: string,
  id: unknown,
  notFound: string
): Promise<Record<string, unknown> | null> {
  if (id === null || id === '') {
    return null;
  }
  if (typeof id !== 'string') {
    throw new Error(notFound);
  }
  const key = `${table}#${id}`;
  const known = derivations.get(key);
  if (known !== undefined) {
    return known;
  }
  const row = (
    await client.query<Record<string, unknown>>(`SELECT * FROM "${table}" WHERE id = $1`, [id])
  ).rows.at(0);
  if (row === undefined) {
    throw new Error(notFound);
  }
  derivations.set(key, row);
  return row;
}

export async function deriveGameType(
  $client: Queryable,
  $row: Record<string, unknown>,
  callerId: string | null,
  __budget: StepBudget = createStepBudget(),
  __derivations: Derivations = new Map()
): Promise<Record<string, unknown>> {
  const $derivationKey = `GameType:${String($row.id)}`;
  const $known = __derivations.get($derivationKey);
  if ($known !== undefined) {
    return $known;
  }
  const $self = $row as {
    id: string;
    name: string;
    category: string;
    rulesVariant: string;
    defaultRating: number;
    description: string;
    displayName: string;
    leaderboard: string[];
  };
  const displayName = `${String($self.name)} (${String($self.rulesVariant)})`;
  const $collection0 = (
    await $client.query<Record<string, unknown>>(
      'SELECT * FROM "LeaderboardEntry" WHERE "gameId" = $1',
      [$self.id]
    )
  ).rows as Array<{
    id: string;
    playerId: string;
    gameId: string;
    rating: number;
    matchesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    lastPlayedAt: string;
    playerNickname: string;
  }>;
  const $filter0: Array<{
    id: string;
    playerId: string;
    gameId: string;
    rating: number;
    matchesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    lastPlayedAt: string;
    playerNickname: string;
  }> = [];
  for (const $item1 of $collection0) {
    __budget(1);
    if ($item1.gameId === $self.id) {
      $filter0.push($item1);
    }
  }
  const leaderboard = $filter0;
  const $computed = { ...$row, displayName, leaderboard };
  __derivations.set($derivationKey, $computed);
  return $computed;
}

export async function deriveGameTypeRows(
  $client: Queryable,
  rows: Array<Record<string, unknown>>,
  callerId: string | null,
  budgetFor: () => StepBudget = createStepBudget,
  __derivations: Derivations = new Map()
): Promise<Array<Record<string, unknown>>> {
  const computed: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    computed.push(await deriveGameType($client, row, callerId, budgetFor(), __derivations));
  }
  return computed;
}

export async function deriveMatch(
  $client: Queryable,
  $row: Record<string, unknown>,
  callerId: string | null,
  __budget: StepBudget = createStepBudget(),
  __derivations: Derivations = new Map()
): Promise<Record<string, unknown>> {
  const $derivationKey = `Match:${String($row.id)}`;
  const $known = __derivations.get($derivationKey);
  if ($known !== undefined) {
    return $known;
  }
  const $self = $row as {
    id: string;
    gameId: string;
    playerOneId: string;
    playerTwoId: string;
    scheduledAt: string;
    status: string;
    outcome: string;
    playerOneScore: number;
    playerTwoScore: number;
    playerOneRatingDelta: number;
    playerTwoRatingDelta: number;
    notes: string;
    recordedById: string;
    createdAt: string;
    title: string;
    gameDisplayName: string;
  };
  const $referenceRow0 = await referencedRow(
    $client,
    __derivations,
    'GameType',
    $self.gameId,
    "Calculated field of 'Match': referenced 'GameType' record not found"
  );
  const $reference1 = (
    $referenceRow0 === null
      ? {
          id: '',
          name: '',
          category: '',
          rulesVariant: '',
          defaultRating: 0,
          description: '',
          displayName: '',
          leaderboard: [],
        }
      : await deriveGameType($client, $referenceRow0, callerId, __budget, __derivations)
  ) as {
    id: string;
    name: string;
    category: string;
    rulesVariant: string;
    defaultRating: number;
    description: string;
    displayName: string;
    leaderboard: string[];
  };
  const $referenceRow2 = await referencedRow(
    $client,
    __derivations,
    'Player',
    $self.playerOneId,
    "Calculated field of 'Match': referenced 'Player' record not found"
  );
  const $reference3 = ($referenceRow2 ?? {
    id: '',
    nickname: '',
    fullName: '',
    emailAddress: '',
    avatar: '',
    bio: '',
    joinedDate: '',
    userAccountId: '',
  }) as {
    id: string;
    nickname: string;
    fullName: string;
    emailAddress: string;
    avatar: string;
    bio: string;
    joinedDate: string;
    userAccountId: string;
  };
  const $referenceRow4 = await referencedRow(
    $client,
    __derivations,
    'Player',
    $self.playerTwoId,
    "Calculated field of 'Match': referenced 'Player' record not found"
  );
  const $reference5 = ($referenceRow4 ?? {
    id: '',
    nickname: '',
    fullName: '',
    emailAddress: '',
    avatar: '',
    bio: '',
    joinedDate: '',
    userAccountId: '',
  }) as {
    id: string;
    nickname: string;
    fullName: string;
    emailAddress: string;
    avatar: string;
    bio: string;
    joinedDate: string;
    userAccountId: string;
  };
  const title = `${String($reference1.displayName)}: ${String($reference3.nickname)} vs ${String($reference5.nickname)}`;
  const gameDisplayName = $reference1.displayName;
  const $computed = { ...$row, title, gameDisplayName };
  __derivations.set($derivationKey, $computed);
  return $computed;
}

export async function deriveMatchRows(
  $client: Queryable,
  rows: Array<Record<string, unknown>>,
  callerId: string | null,
  budgetFor: () => StepBudget = createStepBudget,
  __derivations: Derivations = new Map()
): Promise<Array<Record<string, unknown>>> {
  const computed: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    computed.push(await deriveMatch($client, row, callerId, budgetFor(), __derivations));
  }
  return computed;
}

export async function deriveLeaderboardEntry(
  $client: Queryable,
  $row: Record<string, unknown>,
  callerId: string | null,
  __budget: StepBudget = createStepBudget(),
  __derivations: Derivations = new Map()
): Promise<Record<string, unknown>> {
  const $derivationKey = `LeaderboardEntry:${String($row.id)}`;
  const $known = __derivations.get($derivationKey);
  if ($known !== undefined) {
    return $known;
  }
  const $self = $row as {
    id: string;
    playerId: string;
    gameId: string;
    rating: number;
    matchesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    lastPlayedAt: string;
    playerNickname: string;
  };
  const $referenceRow0 = await referencedRow(
    $client,
    __derivations,
    'Player',
    $self.playerId,
    "Calculated field of 'LeaderboardEntry': referenced 'Player' record not found"
  );
  const $reference1 = ($referenceRow0 ?? {
    id: '',
    nickname: '',
    fullName: '',
    emailAddress: '',
    avatar: '',
    bio: '',
    joinedDate: '',
    userAccountId: '',
  }) as {
    id: string;
    nickname: string;
    fullName: string;
    emailAddress: string;
    avatar: string;
    bio: string;
    joinedDate: string;
    userAccountId: string;
  };
  const playerNickname = $reference1.nickname;
  const $computed = { ...$row, playerNickname };
  __derivations.set($derivationKey, $computed);
  return $computed;
}

export async function deriveLeaderboardEntryRows(
  $client: Queryable,
  rows: Array<Record<string, unknown>>,
  callerId: string | null,
  budgetFor: () => StepBudget = createStepBudget,
  __derivations: Derivations = new Map()
): Promise<Array<Record<string, unknown>>> {
  const computed: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    computed.push(await deriveLeaderboardEntry($client, row, callerId, budgetFor(), __derivations));
  }
  return computed;
}
