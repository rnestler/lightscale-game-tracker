import { httpClient } from './httpClient';
import type { QueryPage, QueryRequest } from './pagination';
import type * as $Domain from '../types/domain';

export interface CreateGameTypeInput {
  name: string;
  category?: string;
  rulesVariant?: string;
  defaultRating?: number;
  description?: string;
}

export interface UpdateGameTypeInput {
  id: string;
  name: string;
  category: string;
  rulesVariant: string;
  defaultRating: number;
  description: string;
}

export const gamesApi = {
  list(): Promise<string[]> {
    return httpClient.get<string[]>('/games');
  },
  multiGet(ids: string[]): Promise<$Domain.GameType[]> {
    return httpClient.records<$Domain.GameType>('/games/multi-get', ids);
  },
  query(request: QueryRequest): Promise<QueryPage> {
    return httpClient.query<QueryPage>('/games/query', request);
  },
  create(input: CreateGameTypeInput): Promise<$Domain.GameType> {
    return httpClient.post<$Domain.GameType>('/games', input);
  },
  addReference(recordId: string): Promise<void> {
    return httpClient.post<void>('/games', { recordId });
  },
  update(input: UpdateGameTypeInput): Promise<$Domain.GameType> {
    return httpClient.put<$Domain.GameType>(`/games/${input.id}`, {
      name: input.name,
      category: input.category,
      rulesVariant: input.rulesVariant,
      defaultRating: input.defaultRating,
      description: input.description,
    });
  },
  delete(id: string): Promise<void> {
    return httpClient.delete<void>(`/games/${id}`);
  },
};
