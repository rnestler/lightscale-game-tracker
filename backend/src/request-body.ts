import express from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const READ_ONLY_POST_SUFFIXES = ['/query', '/multi-get'];
const GUEST_UPLOADS_IN_FLIGHT = 4;

export interface UploadBodyLimits {
  signedIn: number;
  guest: number | null;
}

export type SessionProbe = (request: Request) => Promise<boolean>;

let guestUploadsInFlight = 0;

export function isWriteRequest(request: Request): boolean {
  if (READ_METHODS.has(request.method)) {
    return false;
  }
  return (
    request.method !== 'POST' ||
    !READ_ONLY_POST_SUFFIXES.some((suffix) => request.path.endsWith(suffix))
  );
}

function parseGuestUpload(
  parser: RequestHandler,
  request: Request,
  response: Response,
  next: NextFunction
): void {
  if (guestUploadsInFlight >= GUEST_UPLOADS_IN_FLIGHT) {
    response.status(429).json({ error: 'Too many uploads in progress', code: 'UPLOADS_BUSY' });
    return;
  }
  guestUploadsInFlight += 1;
  response.once('close', () => {
    guestUploadsInFlight -= 1;
  });
  parser(request, response, next);
}

export function uploadBodyParser(limits: UploadBodyLimits, signedIn: SessionProbe): RequestHandler {
  const signedInParser = express.json({ limit: limits.signedIn });
  const guestParser = limits.guest === null ? null : express.json({ limit: limits.guest });
  return (request, response, next) => {
    if (!isWriteRequest(request)) {
      next();
      return;
    }
    signedIn(request).then((session) => {
      if (session) {
        signedInParser(request, response, next);
      } else if (guestParser === null) {
        next();
      } else {
        parseGuestUpload(guestParser, request, response, next);
      }
    }, next);
  };
}
