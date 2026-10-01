import { i18n } from '../i18n/text';
interface RecordNames {
  one: () => string;
  many: () => string;
  fields: Readonly<Partial<Record<string, () => string>>>;
}

const RECORD_NAMES: Readonly<Partial<Record<string, RecordNames>>> = {
  GameType: {
    one: (): string => i18n.word('GameType'),
    many: (): string => i18n.word('GameType', 1),
    fields: {
      id: (): string => 'Id',
      name: (): string => i18n.word('GameType.name'),
      category: (): string => i18n.word('GameType.category'),
      rulesVariant: (): string => i18n.word('GameType.rulesVariant'),
      defaultRating: (): string => i18n.word('GameType.defaultRating'),
      description: (): string => i18n.word('GameType.description'),
      displayName: (): string => i18n.word('GameType.displayName'),
      leaderboard: (): string => i18n.word('GameType.leaderboard'),
    },
  },
  Player: {
    one: (): string => i18n.word('Player'),
    many: (): string => i18n.word('Player', 1),
    fields: {
      id: (): string => 'Id',
      nickname: (): string => i18n.word('Player.nickname'),
      fullName: (): string => i18n.word('Player.fullName'),
      emailAddress: (): string => i18n.word('Player.emailAddress'),
      avatar: (): string => i18n.word('Player.avatar'),
      bio: (): string => i18n.word('Player.bio'),
      joinedDate: (): string => i18n.word('Player.joinedDate'),
      userAccountId: (): string => i18n.word('Player.userAccount'),
    },
  },
  LeaderboardEntry: {
    one: (): string => i18n.word('LeaderboardEntry'),
    many: (): string => i18n.word('LeaderboardEntry', 1),
    fields: {
      id: (): string => 'Id',
      playerId: (): string => i18n.word('LeaderboardEntry.player'),
      gameId: (): string => i18n.word('LeaderboardEntry.game'),
      rating: (): string => i18n.word('LeaderboardEntry.rating'),
      matchesPlayed: (): string => i18n.word('LeaderboardEntry.matchesPlayed'),
      wins: (): string => i18n.word('LeaderboardEntry.wins'),
      losses: (): string => i18n.word('LeaderboardEntry.losses'),
      draws: (): string => i18n.word('LeaderboardEntry.draws'),
      lastPlayedAt: (): string => i18n.word('LeaderboardEntry.lastPlayedAt'),
      playerNickname: (): string => i18n.word('LeaderboardEntry.playerNickname'),
    },
  },
  Match: {
    one: (): string => i18n.word('Match'),
    many: (): string => i18n.word('Match', 1),
    fields: {
      id: (): string => 'Id',
      gameId: (): string => i18n.word('Match.game'),
      playerOneId: (): string => i18n.word('Match.playerOne'),
      playerTwoId: (): string => i18n.word('Match.playerTwo'),
      scheduledAt: (): string => i18n.word('Match.scheduledAt'),
      status: (): string => i18n.word('Match.status'),
      outcome: (): string => i18n.word('Match.outcome'),
      playerOneScore: (): string => i18n.word('Match.playerOneScore'),
      playerTwoScore: (): string => i18n.word('Match.playerTwoScore'),
      playerOneRatingDelta: (): string => i18n.word('Match.playerOneRatingDelta'),
      playerTwoRatingDelta: (): string => i18n.word('Match.playerTwoRatingDelta'),
      notes: (): string => i18n.word('Match.notes'),
      recordedById: (): string => i18n.word('Match.recordedBy'),
      createdAt: (): string => i18n.word('Match.createdAt'),
      title: (): string => i18n.word('Match.title'),
      gameDisplayName: (): string => i18n.word('Match.gameDisplayName'),
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
  return namesOf(type).one();
}

export function recordPlural(type: string): string {
  return namesOf(type).many();
}

export function fieldLabel(type: string, field: string): string {
  const label = namesOf(type).fields[field];
  if (label === undefined) {
    throw new Error(`No name for field '${field}' of record type '${type}'`);
  }
  return label();
}

export function fieldLabels(type: string, fields: readonly string[]): string {
  const labels: string[] = [];
  for (const field of fields) {
    labels.push(fieldLabel(type, field));
  }
  return labels.join(', ');
}
