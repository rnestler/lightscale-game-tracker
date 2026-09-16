import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

const SUBMISSION_TOKEN_HEADER = 'x-submission-token';
const SUBMISSION_TRAP_HEADER = 'x-submission-trap';
const MINIMUM_FILL_MS = 1500;
const TOKEN_LIFETIME_MS = 12 * 60 * 60 * 1000;
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/;

export type SubmissionVerdict = 'accept' | 'refuse' | 'hasty' | 'drop';

export type SubmissionRefusal = Extract<SubmissionVerdict, 'refuse' | 'hasty'>;

export interface SubmissionToken {
  token: string;
  lifetimeMs: number;
  minimumFillMs: number;
}

export const SUBMISSION_REFUSALS: Record<SubmissionRefusal, { error: string; code: string }> = {
  refuse: { error: 'Submission rejected', code: 'SUBMISSION_REJECTED' },
  hasty: { error: 'Submission sent too early', code: 'SUBMISSION_TOO_EARLY' },
};

function signingSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret === undefined || secret.trim().length === 0) {
    throw new Error('Missing required environment variable: BETTER_AUTH_SECRET');
  }
  return secret;
}

function signature(issuedAt: string, nonce: string): string {
  return createHmac('sha256', signingSecret()).update(`${issuedAt}.${nonce}`).digest('hex');
}

export function issueSubmissionToken(now: number): SubmissionToken {
  const issuedAt = String(now);
  const nonce = randomBytes(12).toString('hex');
  return {
    token: `${issuedAt}.${nonce}.${signature(issuedAt, nonce)}`,
    lifetimeMs: TOKEN_LIFETIME_MS,
    minimumFillMs: MINIMUM_FILL_MS,
  };
}

function tokenVerdict(token: string | null, now: number): SubmissionVerdict {
  if (token === null) {
    return 'refuse';
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return 'refuse';
  }
  const [issuedAt, nonce, signed] = parts;
  if (!SIGNATURE_PATTERN.test(signed)) {
    return 'refuse';
  }
  if (!timingSafeEqual(Buffer.from(signed), Buffer.from(signature(issuedAt, nonce)))) {
    return 'refuse';
  }
  const age = now - Number(issuedAt);
  if (!Number.isFinite(age) || age > TOKEN_LIFETIME_MS) {
    return 'refuse';
  }
  return age < MINIMUM_FILL_MS ? 'hasty' : 'accept';
}

function headerValue(request: Request, name: string): string | null {
  const value = request.headers[name];
  return typeof value === 'string' && value !== '' ? value : null;
}

export function submissionVerdict(request: Request, now: number): SubmissionVerdict {
  if (headerValue(request, SUBMISSION_TRAP_HEADER) !== null) {
    return 'drop';
  }
  return tokenVerdict(headerValue(request, SUBMISSION_TOKEN_HEADER), now);
}
