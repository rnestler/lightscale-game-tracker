import type { Pool, PoolClient } from 'pg';

const SERIALIZATION_FAILURE = '40001';
const DEADLOCK_DETECTED = '40P01';
const MAX_TRANSACTION_ATTEMPTS = 8;
const RETRY_BACKOFF_BASE_MS = 20;

export function isRetriableTransactionError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === SERIALIZATION_FAILURE || error.code === DEADLOCK_DETECTED)
  );
}

function retryBackoff(attempt: number): Promise<void> {
  const ceiling = RETRY_BACKOFF_BASE_MS * 2 ** (attempt - 1);
  return new Promise((resolve) => setTimeout(resolve, Math.random() * ceiling));
}

export async function withTransaction<T>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      if (!isRetriableTransactionError(error) || attempt === MAX_TRANSACTION_ATTEMPTS) {
        throw error;
      }
      await retryBackoff(attempt);
    } finally {
      client.release();
    }
  }
  throw new Error('Transaction did not settle within the attempt budget');
}

export function joinTransaction<T>(
  pool: Pool,
  joined: PoolClient | null,
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  return joined === null ? withTransaction(pool, operation) : operation(joined);
}
