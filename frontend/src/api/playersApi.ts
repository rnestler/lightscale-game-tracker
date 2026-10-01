import { httpClient } from './httpClient';
import type { QueryPage, QueryRequest } from './pagination';
import type * as $Domain from '../types/domain';
import type { FileUploadValue, FileValue } from '../types/file';

export interface CreatePlayerInput {
  nickname: string;
  fullName: string;
  emailAddress: string;
  avatar?: FileUploadValue | FileValue | null;
  bio?: string;
  joinedDate?: string;
  userAccountId?: string;
}

export interface UpdatePlayerInput {
  id: string;
  nickname: string;
  fullName: string;
  emailAddress: string;
  avatar: FileUploadValue | FileValue | null;
  bio: string;
  joinedDate: string;
  userAccountId: string;
}

export const playersApi = {
  list(): Promise<string[]> {
    return httpClient.get<string[]>('/players');
  },
  multiGet(ids: string[]): Promise<$Domain.Player[]> {
    return httpClient.records<$Domain.Player>('/players/multi-get', ids);
  },
  query(request: QueryRequest): Promise<QueryPage> {
    return httpClient.query<QueryPage>('/players/query', request);
  },
  create(input: CreatePlayerInput): Promise<$Domain.Player> {
    return httpClient.post<$Domain.Player>('/players', input);
  },
  addReference(recordId: string): Promise<void> {
    return httpClient.post<void>('/players', { recordId });
  },
  update(input: UpdatePlayerInput): Promise<$Domain.Player> {
    return httpClient.put<$Domain.Player>(`/players/${input.id}`, {
      nickname: input.nickname,
      fullName: input.fullName,
      emailAddress: input.emailAddress,
      avatar: input.avatar,
      bio: input.bio,
      joinedDate: input.joinedDate,
      userAccountId: input.userAccountId,
    });
  },
  delete(id: string): Promise<void> {
    return httpClient.delete<void>(`/players/${id}`);
  },
};
