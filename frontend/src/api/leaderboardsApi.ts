import { httpClient } from './httpClient';
import type { QueryPage, QueryRequest } from './pagination';
import type * as $Domain from '../types/domain';

export interface CreateLeaderboardEntryInput {
  playerId: string;
  gameId: string;
  rating?: number;
  matchesPlayed?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  lastPlayedAt?: string;
}

export interface UpdateLeaderboardEntryInput {
  id: string;
  playerId: string;
  gameId: string;
  rating: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  lastPlayedAt: string;
}

export const leaderboardsApi = {
  list(): Promise<string[]> {
    return httpClient.get<string[]>('/leaderboards');
  },
  multiGet(ids: string[]): Promise<$Domain.LeaderboardEntry[]> {
    return httpClient.records<$Domain.LeaderboardEntry>('/leaderboards/multi-get', ids);
  },
  query(request: QueryRequest): Promise<QueryPage> {
    return httpClient.query<QueryPage>('/leaderboards/query', request);
  },
  create(input: CreateLeaderboardEntryInput): Promise<$Domain.LeaderboardEntry> {
    return httpClient.post<$Domain.LeaderboardEntry>('/leaderboards', input);
  },
  addReference(recordId: string): Promise<void> {
    return httpClient.post<void>('/leaderboards', { recordId });
  },
  update(input: UpdateLeaderboardEntryInput): Promise<$Domain.LeaderboardEntry> {
    return httpClient.put<$Domain.LeaderboardEntry>(`/leaderboards/${input.id}`, {
      playerId: input.playerId,
      gameId: input.gameId,
      rating: input.rating,
      matchesPlayed: input.matchesPlayed,
      wins: input.wins,
      losses: input.losses,
      draws: input.draws,
      lastPlayedAt: input.lastPlayedAt,
    });
  },
  delete(id: string): Promise<void> {
    return httpClient.delete<void>(`/leaderboards/${id}`);
  },
};
