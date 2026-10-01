import { pool } from './db.js';
import { sendNotificationEmail } from './auth.js';
import { recordRuntimeError } from './utils/diagnostics.js';

const MAX_ATTEMPTS = 5;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const POLL_INTERVAL_MS = 15000;
const BATCH_SIZE = 50;

interface OutboxRow {
  id: string;
  notification: string;
  channel: string;
  recipient: string;
  subject: string;
  body: string;
  html: string;
  inReplyTo: string;
  attachmentName: string;
  attachmentBody: string;
  attempts: number;
}

async function pendingRows(): Promise<OutboxRow[]> {
  const { rows } = await pool.query<OutboxRow>(
    'SELECT id, notification, channel, recipient, subject, body, html, "inReplyTo", "attachmentName", "attachmentBody", attempts FROM "_outbox" WHERE "sentAt" = $1 AND attempts < $2 ORDER BY "createdAt" LIMIT $3',
    ['', MAX_ATTEMPTS, BATCH_SIZE]
  );
  return rows;
}

async function markSent(id: string): Promise<void> {
  await pool.query('UPDATE "_outbox" SET "sentAt" = $1, "lastError" = $2 WHERE id = $3', [
    new Date().toISOString(),
    '',
    id,
  ]);
}

async function markFailed(row: OutboxRow, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await pool.query('UPDATE "_outbox" SET attempts = $1, "lastError" = $2 WHERE id = $3', [
    row.attempts + 1,
    message.slice(0, 500),
    row.id,
  ]);
  recordRuntimeError(`outbox.deliver ${row.id} attempt ${row.attempts + 1}`, error);
}

async function removeExpired(): Promise<void> {
  await pool.query('DELETE FROM "_outbox" WHERE "sentAt" <> $1 AND "createdAt" < $2', [
    '',
    new Date(Date.now() - RETENTION_MS).toISOString(),
  ]);
}

async function deliver(row: OutboxRow): Promise<void> {
  await sendNotificationEmail(row);
}

async function dispatchRow(row: OutboxRow): Promise<void> {
  try {
    await deliver(row);
    await markSent(row.id);
  } catch (error) {
    await markFailed(row, error);
  }
}

export async function dispatchOutbox(): Promise<void> {
  for (const row of await pendingRows()) {
    await dispatchRow(row);
  }
  await removeExpired();
}

export function startOutboxDispatcher(): void {
  const timer = setInterval(() => {
    dispatchOutbox().catch((error: unknown) => {
      recordRuntimeError('outbox.dispatch', error);
    });
  }, POLL_INTERVAL_MS);
  timer.unref();
}
