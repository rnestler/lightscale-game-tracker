import { httpClient } from './httpClient';
import type { QueryPage, QueryRequest } from './pagination';
import type * as $Domain from '../types/domain';

export interface CreateMatchInput {
  gameId: string;
  playerOneId: string;
  playerTwoId: string;
  scheduledAt?: string;
  status?: string;
  outcome?: string;
  notes?: string;
}

export interface UpdateMatchInput {
  id: string;
  gameId: string;
  playerOneId: string;
  playerTwoId: string;
  scheduledAt: string;
  status: string;
  outcome: string;
  notes: string;
}

export const matchesApi = {
  list(): Promise<string[]> {
    return httpClient.get<string[]>('/matches');
  },
  multiGet(ids: string[]): Promise<$Domain.Match[]> {
    return httpClient.records<$Domain.Match>('/matches/multi-get', ids);
  },
  query(request: QueryRequest): Promise<QueryPage> {
    return httpClient.query<QueryPage>('/matches/query', request);
  },
  create(input: CreateMatchInput): Promise<$Domain.Match> {
    return httpClient.post<$Domain.Match>('/matches', input);
  },
  addReference(recordId: string): Promise<void> {
    return httpClient.post<void>('/matches', { recordId });
  },
  update(input: UpdateMatchInput): Promise<$Domain.Match> {
    return httpClient.put<$Domain.Match>(`/matches/${input.id}`, {
      gameId: input.gameId,
      playerOneId: input.playerOneId,
      playerTwoId: input.playerTwoId,
      scheduledAt: input.scheduledAt,
      status: input.status,
      outcome: input.outcome,
      notes: input.notes,
    });
  },
  delete(id: string): Promise<void> {
    return httpClient.delete<void>(`/matches/${id}`);
  },
};
