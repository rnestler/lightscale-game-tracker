import express from 'express';
import cors from 'cors';
import { fromNodeHeaders } from 'better-auth/node';
import { auth, authRequestHandler } from './auth.js';
import { uploadBodyParser, type SessionProbe } from './request-body.js';
import { errorRefusal } from './error-refusals.js';
import { issueSubmissionToken } from './submission-guard.js';
import { selectRequestLanguage } from './utils/language.js';
import { mountBuiltFrontend } from './frontend.js';
import type { BuiltFrontend } from './frontend.js';
import { adminRouter } from './routes/admin.js';
import { setupStatusRouter } from './routes/setupStatus.js';
import { filesRouter } from './routes/files.js';
import { placesProxyRouter } from './routes/placesProxy.js';
import { privacyRouter } from './routes/privacy.js';
import { gamesRouter, gamesViolationsRouter } from './routes/games.js';
import { playersRouter, playersViolationsRouter } from './routes/players.js';
import { matchesRouter, matchesViolationsRouter } from './routes/matches.js';
import { leaderboardsRouter, leaderboardsViolationsRouter } from './routes/leaderboards.js';
import { startMatchTransactionRouter } from './routes/startMatchTransaction.js';
import { disputeMatchTransactionRouter } from './routes/disputeMatchTransaction.js';
import { cancelMatchTransactionRouter } from './routes/cancelMatchTransaction.js';
import { completeMatchTransactionRouter } from './routes/completeMatchTransaction.js';
import { ConstraintViolationError } from './constraints.js';

function setSecurityHeaders(
  _request: express.Request,
  response: express.Response,
  next: express.NextFunction
): void {
  response.removeHeader('X-Powered-By');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader(
    'Permissions-Policy',
    'accelerometer=(), browsing-topics=(), camera=(), geolocation=(), gyroscope=(), interest-cohort=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );
  next();
}

interface AuthRateLimitBucket {
  count: number;
  resetAt: number;
}

const authRateLimitWindowMs = 60_000;
const authRateLimitMaxRequests = 20;
const authRateLimitBuckets = new Map<string, AuthRateLimitBucket>();

const sessionCheckRateLimitMaxRequests = 120;
const sessionCheckRateLimitBuckets = new Map<string, AuthRateLimitBucket>();

function isPassiveSessionCheck(request: express.Request): boolean {
  return request.method === 'GET' && request.path.endsWith('/get-session');
}

function evictExpiredBuckets(buckets: Map<string, AuthRateLimitBucket>, now: number): void {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) {
      buckets.delete(key);
    }
  }
}

function checkRateLimit(
  buckets: Map<string, AuthRateLimitBucket>,
  key: string,
  maxRequests: number
): boolean {
  const now = Date.now();
  evictExpiredBuckets(buckets, now);
  const bucket = buckets.get(key);
  if (bucket === undefined || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + authRateLimitWindowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= maxRequests;
}

function checkAuthRateLimit(key: string): boolean {
  return checkRateLimit(authRateLimitBuckets, key, authRateLimitMaxRequests);
}

function checkSessionCheckRateLimit(key: string): boolean {
  return checkRateLimit(sessionCheckRateLimitBuckets, key, sessionCheckRateLimitMaxRequests);
}

function reportRefusal(
  error: unknown,
  _request: express.Request,
  response: express.Response,
  next: express.NextFunction
): void {
  if (error instanceof ConstraintViolationError) {
    response
      .status(422)
      .json({ error: error.message, code: 'PRECONDITION_FAILED', refusal: error.refusal });
    return;
  }
  next(error);
}

function clientErrorStatus(error: unknown): number | null {
  const status =
    typeof error === 'object' && error !== null && 'status' in error ? error.status : null;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : null;
}

function clientErrorCode(error: unknown): { code?: string } {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  return typeof code === 'string' ? { code } : {};
}

function reportUnhandledError(
  error: unknown,
  _request: express.Request,
  response: express.Response,
  _next: express.NextFunction
): void {
  const refusal = errorRefusal(error);
  if (refusal !== null) {
    if (refusal.status >= 500) {
      console.error(error);
    }
    response.status(refusal.status).json(refusal.body);
    return;
  }
  const clientStatus = clientErrorStatus(error);
  if (clientStatus !== null) {
    response.status(clientStatus).json({ error: 'Invalid request', ...clientErrorCode(error) });
    return;
  }
  console.error(error);
  if (response.headersSent) {
    response.end();
    return;
  }
  response.status(500).json({ error: 'Internal error' });
}

const hasSession: SessionProbe = async (request) =>
  (await auth.api.getSession({ headers: fromNodeHeaders(request.headers) })) !== null;

export function createServer(frontend: BuiltFrontend | null): express.Express {
  const app = express();
  const trustProxy = process.env.TRUST_PROXY ?? '';
  if (trustProxy !== '') {
    app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  }
  app.use(setSecurityHeaders);
  app.use(selectRequestLanguage);
  const corsOrigin = process.env.CORS_ORIGIN ?? '';
  if (corsOrigin !== '') {
    app.use(cors({ credentials: true, origin: corsOrigin }));
  }
  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });
  if (frontend !== null) {
    mountBuiltFrontend(app, frontend);
  }
  app.use('/games', uploadBodyParser({ signedIn: 78643200, guest: null }, hasSession));
  app.use('/players', uploadBodyParser({ signedIn: 78643200, guest: null }, hasSession));
  app.use('/matches', uploadBodyParser({ signedIn: 78643200, guest: null }, hasSession));
  app.use('/leaderboards', uploadBodyParser({ signedIn: 78643200, guest: null }, hasSession));
  app.use(express.json({ limit: 1048576 }));
  app.get('/api/submission-token', (_request, response) => {
    response.json(issueSubmissionToken(Date.now()));
  });
  app.all('/api/auth/*path', (request, response) => {
    const withinRateLimit = isPassiveSessionCheck(request)
      ? checkSessionCheckRateLimit(request.ip ?? 'unknown')
      : checkAuthRateLimit(request.ip ?? 'unknown');
    if (!withinRateLimit) {
      response.status(429).json({ error: 'Too many requests' });
      return;
    }
    authRequestHandler(request, response).catch(() => {
      response.status(500).json({ error: 'Authentication error' });
    });
  });
  app.use('/api/places', placesProxyRouter);
  app.use('/api/setup-status', setupStatusRouter);
  app.use('/api', adminRouter);
  app.use('/api', privacyRouter);
  app.use('/api/files', filesRouter);
  app.use('/api/rule-violations/games', gamesViolationsRouter);
  app.use('/api/rule-violations/players', playersViolationsRouter);
  app.use('/api/rule-violations/matches', matchesViolationsRouter);
  app.use('/api/rule-violations/leaderboards', leaderboardsViolationsRouter);
  app.use('/games', gamesRouter);
  app.use('/players', playersRouter);
  app.use('/matches', matchesRouter);
  app.use('/leaderboards', leaderboardsRouter);
  app.use('/api/transactions/startMatch', startMatchTransactionRouter);
  app.use('/api/transactions/disputeMatch', disputeMatchTransactionRouter);
  app.use('/api/transactions/cancelMatch', cancelMatchTransactionRouter);
  app.use('/api/transactions/completeMatch', completeMatchTransactionRouter);
  app.use(reportRefusal);
  app.use(reportUnhandledError);
  return app;
}
