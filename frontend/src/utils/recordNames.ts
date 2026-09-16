interface RecordNames {
  one: string;
  many: string;
  fields: Readonly<Partial<Record<string, string>>>;
}

const RECORD_NAMES: Readonly<Partial<Record<string, RecordNames>>> = {
  GameType: {
    one: 'Game',
    many: 'Games',
    fields: {
      id: 'Id',
      name: 'Game Name',
      category: 'Category',
      rulesVariant: 'Variant / Ruleset',
      defaultRating: 'Starting Rating (Default 1200)',
      description: 'Overview & Rules',
      displayName: 'Display Name',
      leaderboard: 'Game Leaderboard',
    },
  },
  Player: {
    one: 'Player',
    many: 'Players',
    fields: {
      id: 'Id',
      nickname: 'Nickname / Handle',
      fullName: 'Full Name',
      emailAddress: 'Email Address',
      avatar: 'Avatar',
      bio: 'Player Bio',
      joinedDate: 'Member Since',
      userAccountId: 'Linked User',
    },
  },
  LeaderboardEntry: {
    one: 'Leaderboard Entry',
    many: 'Leaderboard Entries',
    fields: {
      id: 'Id',
      playerId: 'Player',
      gameId: 'Game',
      rating: 'Current Rating',
      matchesPlayed: 'Matches Played',
      wins: 'Wins',
      losses: 'Losses',
      draws: 'Draws',
      lastPlayedAt: 'Last Activity',
      playerNickname: 'Player Nickname',
    },
  },
  Match: {
    one: 'Match',
    many: 'Matches',
    fields: {
      id: 'Id',
      gameId: 'Game',
      playerOneId: 'Player 1',
      playerTwoId: 'Player 2',
      scheduledAt: 'Date & Time',
      status: 'Status',
      outcome: 'Outcome',
      playerOneScore: 'P1 Score',
      playerTwoScore: 'P2 Score',
      playerOneRatingDelta: 'P1 Rating Change',
      playerTwoRatingDelta: 'P2 Rating Change',
      notes: 'Match Notes',
      recordedById: 'Recorder',
      createdAt: 'Created At',
      title: 'Match Matchup',
      gameDisplayName: 'Game Display Name',
    },
  },
};

function namesOf(type: string): RecordNames {
  const names = RECORD_NAMES[type];
  if (names === undefined) {
    throw new Error(`No names for record type '${type}'`);
  }
  return names;
}

export function recordName(type: string): string {
  return namesOf(type).one;
}

export function recordPlural(type: string): string {
  return namesOf(type).many;
}

export function fieldLabel(type: string, field: string): string {
  const label = namesOf(type).fields[field];
  if (label === undefined) {
    throw new Error(`No name for field '${field}' of record type '${type}'`);
  }
  return label;
}

export function fieldLabels(type: string, fields: readonly string[]): string {
  const labels: string[] = [];
  for (const field of fields) {
    labels.push(fieldLabel(type, field));
  }
  return labels.join(', ');
}
