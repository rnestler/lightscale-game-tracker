import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';

const SUBMISSION_TOKEN_HEADER = 'x-submission-token';
const SUBMISSION_TRAP_HEADER = 'x-submission-trap';
const MINIMUM_FILL_MS = 1500;
const TOKEN_LIFETIME_MS = 12 * 60 * 60 * 1000;
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/;
const SUCCESS_LIMIT = 300;

export type SubmissionVerdict = 'accept' | 'refuse' | 'drop';

export interface SubmissionToken {
  token: string;
  lifetimeMs: number;
}

export const SUBMISSION_REFUSAL = { error: 'Submission rejected', code: 'SUBMISSION_REJECTED' };

const redeemed = new Map<string, number>();

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
  };
}

function forgetExpiredRedemptions(now: number): void {
  for (const [nonce, expiresAt] of redeemed) {
    if (expiresAt <= now) {
      redeemed.delete(nonce);
    }
  }
}

function redeemOnSuccess(response: Response, nonce: string, expiresAt: number): void {
  response.once('finish', () => {
    if (response.statusCode < SUCCESS_LIMIT) {
      redeemed.set(nonce, expiresAt);
    }
  });
}

function tokenVerdict(token: string | null, response: Response, now: number): SubmissionVerdict {
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
  forgetExpiredRedemptions(now);
  if (age < MINIMUM_FILL_MS || redeemed.has(nonce)) {
    return 'drop';
  }
  redeemOnSuccess(response, nonce, Number(issuedAt) + TOKEN_LIFETIME_MS);
  return 'accept';
}

function headerValue(request: Request, name: string): string | null {
  const value = request.headers[name];
  return typeof value === 'string' && value !== '' ? value : null;
}

export function submissionVerdict(
  request: Request,
  response: Response,
  now: number
): SubmissionVerdict {
  if (headerValue(request, SUBMISSION_TRAP_HEADER) !== null) {
    return 'drop';
  }
  return tokenVerdict(headerValue(request, SUBMISSION_TOKEN_HEADER), response, now);
}
