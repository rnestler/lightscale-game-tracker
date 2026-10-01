import { AsyncLocalStorage } from 'node:async_hooks';
import type { Pool, PoolClient } from 'pg';

const SERIALIZATION_FAILURE = '40001';
const DEADLOCK_DETECTED = '40P01';
const MAX_TRANSACTION_ATTEMPTS = 8;
const MAX_DEFERRED_WORK = 16;
const RETRY_BACKOFF_BASE_MS = 20;

const openTransaction = new AsyncLocalStorage<boolean>();

export class DeferredWork extends Error {
  constructor(public readonly work: () => Promise<void>) {
    super('The transaction released its locks to finish work outside of it');
    this.name = 'DeferredWork';
  }
}

export function insideTransaction(): boolean {
  return openTransaction.getStore() === true;
}

export function isRetriableTransactionError(error: unknown): boolean {
  return (
    error instanceof DeferredWork ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error.code === SERIALIZATION_FAILURE || error.code === DEADLOCK_DETECTED))
  );
}

function retryBackoff(attempt: number): Promise<void> {
  const ceiling = RETRY_BACKOFF_BASE_MS * 2 ** (attempt - 1);
  return new Promise((resolve) => setTimeout(resolve, Math.random() * ceiling));
}

async function runOnce<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    const result = await openTransaction.run(true, () => operation(client));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function finishDeferredWork(deferred: DeferredWork, deferrals: number): Promise<void> {
  if (deferrals > MAX_DEFERRED_WORK) {
    throw new Error('The transaction deferred more work than its budget admits');
  }
  await deferred.work();
}

async function settle<T>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<T>,
  conflicts: number,
  deferrals: number
): Promise<T> {
  try {
    return await runOnce(pool, operation);
  } catch (error) {
    if (error instanceof DeferredWork) {
      await finishDeferredWork(error, deferrals + 1);
      return settle(pool, operation, conflicts, deferrals + 1);
    }
    if (!isRetriableTransactionError(error) || conflicts + 1 === MAX_TRANSACTION_ATTEMPTS) {
      throw error;
    }
    await retryBackoff(conflicts + 1);
    return settle(pool, operation, conflicts + 1, deferrals);
  }
}

export function withTransaction<T>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  return settle(pool, operation, 0, 0);
}

export function joinTransaction<T>(
  pool: Pool,
  joined: PoolClient | null,
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  return joined === null ? withTransaction(pool, operation) : operation(joined);
}
