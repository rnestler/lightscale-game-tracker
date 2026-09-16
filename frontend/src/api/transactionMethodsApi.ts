import { httpClient } from './httpClient';
import type * as $Domain from '../types/domain';

export const transactionMethodsApi = {
  startMatch(match: $Domain.Match): Promise<void> {
    return httpClient.post<void>('/api/transactions/startMatch', {
      match: match.id,
    });
  },
  disputeMatch(match: $Domain.Match): Promise<void> {
    return httpClient.post<void>('/api/transactions/disputeMatch', {
      match: match.id,
    });
  },
  cancelMatch(match: $Domain.Match): Promise<void> {
    return httpClient.post<void>('/api/transactions/cancelMatch', {
      match: match.id,
    });
  },
  completeMatch(match: $Domain.Match, outcome: string): Promise<void> {
    return httpClient.post<void>('/api/transactions/completeMatch', {
      match: match.id,
      outcome,
    });
  },
};
