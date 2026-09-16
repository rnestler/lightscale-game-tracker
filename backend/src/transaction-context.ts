// Generated with Lightscale AI. This file belongs to the owner of the generated application. See LICENSE.
import type { Queryable } from './db.js';

export type StepBudget = (count?: number) => void;

export interface TransactionContext {
  readonly client: Queryable;
  readonly callerId: string | null;
  readonly budget: StepBudget;
}

export function createStepBudget(): StepBudget {
  let __steps = 0;
  const __budget = (count = 1): void => {
    __steps = __steps + count;
    if (__steps > 100000) {
      throw new Error('Transaction step budget exceeded');
    }
  };
  return __budget;
}

export function transactionContext(client: Queryable, callerId: string | null): TransactionContext {
  return { client, callerId, budget: createStepBudget() };
}
