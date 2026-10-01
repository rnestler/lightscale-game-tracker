import { randomUUID } from 'node:crypto';
import { pool } from './db.js';
import { admissionClause, type Caller, hasGrant, whereClause } from './authorization.js';

interface IdentityRule {
  fields: string[];
  address: string | null;
}

const IDENTITY_RULES: Record<string, IdentityRule[] | undefined> = {
  Player: [
    {
      fields: ['emailAddress'],
      address: 'emailAddress',
    },
  ],
};

const NOTICE = {
  subject: 'Your submission to GameRank Tracker',
  body: 'A new submission with this email address was made to GameRank Tracker. A record with this address already exists, so nothing was changed. If this was not you, you can ignore this email.',
};

const NOTICE_LIMIT = 3;
const NOTICE_WINDOW_MS = 60 * 60 * 1000;
const noticesByAddress = new Map<string, number[]>();

function isSet(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

async function collidingRule(
  table: string,
  body: Record<string, unknown>
): Promise<{ rule: IdentityRule; id: string } | null> {
  for (const rule of IDENTITY_RULES[table] ?? []) {
    if (rule.fields.every((field) => isSet(body[field]))) {
      const conditions = rule.fields.map((field, index) => `"${field}" = $${index + 1}`);
      const { rows } = await pool.query<{ id: string }>(
        `SELECT id FROM "${table}" WHERE ${conditions.join(' AND ')} LIMIT 1`,
        rule.fields.map((field) => body[field])
      );
      const found = rows.at(0);
      if (found !== undefined) {
        return { rule, id: String(found.id) };
      }
    }
  }
  return null;
}

function noticeAllowed(address: string, now: number): boolean {
  for (const [candidate, sentAt] of noticesByAddress) {
    if (sentAt.every((moment) => now - moment >= NOTICE_WINDOW_MS)) {
      noticesByAddress.delete(candidate);
    }
  }
  const recent = (noticesByAddress.get(address) ?? []).filter(
    (moment) => now - moment < NOTICE_WINDOW_MS
  );
  const allowed = recent.length < NOTICE_LIMIT;
  noticesByAddress.set(address, allowed ? [...recent, now] : recent);
  return allowed;
}

async function queueNotice(address: string): Promise<void> {
  await pool.query(
    'INSERT INTO "_outbox" (id, notification, channel, recipient, subject, body, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [
      randomUUID(),
      'duplicateSubmission',
      'email',
      address,
      NOTICE.subject,
      NOTICE.body,
      new Date().toISOString(),
    ]
  );
}

interface IdentityCollision {
  id: string;
  address: string | null;
}

async function identityCollision(
  table: string,
  body: Record<string, unknown>
): Promise<IdentityCollision | null> {
  const colliding = await collidingRule(table, body);
  if (colliding === null) {
    return null;
  }
  const address = colliding.rule.address === null ? null : body[colliding.rule.address];
  return { id: colliding.id, address: typeof address === 'string' ? address : null };
}

async function noticeCollision(collision: IdentityCollision): Promise<void> {
  if (collision.address !== null && noticeAllowed(collision.address, Date.now())) {
    await queueNotice(collision.address);
  }
}

export async function hiddenCollision(
  table: string,
  resource: string,
  exclusion: string | null,
  caller: Caller,
  body: Record<string, unknown>
): Promise<boolean> {
  const collision = await identityCollision(table, body);
  if (collision === null) {
    return false;
  }
  const values: unknown[] = [collision.id];
  const admission = hasGrant(resource, 'read', caller.roles)
    ? admissionClause(resource, 'read', caller, 'f', values)
    : 'FALSE';
  const readable = await pool.query(
    `SELECT 1 FROM "${table}" f${whereClause(['f.id = $1', exclusion, admission])}`,
    values
  );
  if (readable.rows.length > 0) {
    return false;
  }
  await noticeCollision(collision);
  return true;
}

export function shadowRecord(body: Record<string, unknown>): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      record[key] = value;
    }
  }
  record['id'] = randomUUID();
  return record;
}
