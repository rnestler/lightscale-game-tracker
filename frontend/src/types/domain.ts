import type { FileValue } from '../types/file';

export interface GameType {
  readonly _sample?: boolean;
  id: string;
  name: string;
  category: string;
  rulesVariant: string;
  defaultRating: number;
  description: string;
  readonly displayName: string;
  readonly leaderboard: LeaderboardEntry[];
}

export interface Player {
  readonly _sample?: boolean;
  id: string;
  nickname: string;
  fullName: string;
  emailAddress: string;
  avatar: FileValue | null;
  bio: string;
  joinedDate: string;
  userAccountId: string;
}

export interface LeaderboardEntry {
  readonly _sample?: boolean;
  id: string;
  playerId: string;
  gameId: string;
  rating: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  lastPlayedAt: string;
  readonly playerNickname: string;
}

export interface Match {
  readonly _sample?: boolean;
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
  readonly title: string;
  readonly gameDisplayName: string;
}
