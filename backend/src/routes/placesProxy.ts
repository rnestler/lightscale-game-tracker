import { Router } from 'express';
import type { Request, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth.js';
import { pool } from '../db.js';
import { getEffectiveUserRoles, hasAppAccess } from '../authorization.js';

export const placesProxyRouter = Router();

const geocodeCache = new Map<string, { lat: number; lng: number }>();
const GEOCODE_CACHE_MAX = 1000;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const LOOKUPS_PER_MINUTE = 60;
const LOOKUPS_PER_HOUR = 600;

interface LookupWindow {
  count: number;
  resetAt: number;
}

const lookupWindows = new Map<string, LookupWindow>();

function sweepLookupWindows(now: number): void {
  for (const [key, lookupWindow] of lookupWindows) {
    if (now >= lookupWindow.resetAt) {
      lookupWindows.delete(key);
    }
  }
}

function withinLookupLimit(key: string, limit: number, windowMs: number, now: number): boolean {
  const lookupWindow = lookupWindows.get(key);
  if (lookupWindow === undefined || now >= lookupWindow.resetAt) {
    lookupWindows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  lookupWindow.count += 1;
  return lookupWindow.count <= limit;
}

function lookupAllowed(userId: string): boolean {
  const now = Date.now();
  if (lookupWindows.size >= 10_000) {
    sweepLookupWindows(now);
  }
  const minute = withinLookupLimit(`minute:${userId}`, LOOKUPS_PER_MINUTE, MINUTE_MS, now);
  const hour = withinLookupLimit(`hour:${userId}`, LOOKUPS_PER_HOUR, HOUR_MS, now);
  return minute && hour;
}

async function placesCaller(request: Request, response: Response): Promise<string | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!session) {
    response
      .status(401)
      .json({ error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED' });
    return null;
  }
  if (!hasAppAccess(await getEffectiveUserRoles(pool, session.user.id))) {
    response.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return session.user.id;
}

async function lookupCaller(request: Request, response: Response): Promise<boolean> {
  const userId = await placesCaller(request, response);
  if (userId === null) {
    return false;
  }
  if (!lookupAllowed(userId)) {
    response.status(429).json({ error: 'Too many address lookups', code: 'RATE_LIMITED' });
    return false;
  }
  return true;
}

placesProxyRouter.get('/maps-key', async (request, response) => {
  if ((await placesCaller(request, response)) === null) {
    return;
  }
  const key = process.env['GOOGLE_MAPS_BROWSER_KEY'] ?? '';
  if (key === '') {
    response.status(503).json({ error: 'Maps browser key not configured' });
    return;
  }
  response.json({ key });
});

placesProxyRouter.post('/geocode', async (request, response) => {
  if (!(await lookupCaller(request, response))) {
    return;
  }
  const key = process.env['GOOGLE_MAPS_API_KEY'] ?? '';
  if (key === '') {
    response.status(503).json({ error: 'Places API not configured' });
    return;
  }
  const body = request.body as { address?: unknown };
  if (typeof body.address !== 'string' || body.address.trim().length === 0) {
    response.status(400).json({ error: 'address required' });
    return;
  }
  const normalized = body.address.trim().toLowerCase();
  const cached = geocodeCache.get(normalized);
  if (cached !== undefined) {
    response.json(cached);
    return;
  }
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', body.address);
  url.searchParams.set('key', key);
  const googleResponse = await fetch(url);
  if (!googleResponse.ok) {
    response.status(googleResponse.status).json({ error: 'Places upstream error' });
    return;
  }
  const data = (await googleResponse.json()) as {
    status?: string;
    results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>;
  };
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    response.status(502).json({ error: 'Geocoding failed' });
    return;
  }
  const location = data.results?.[0]?.geometry?.location;
  if (typeof location?.lat !== 'number' || typeof location.lng !== 'number') {
    response.json({ notFound: true });
    return;
  }
  const point = { lat: location.lat, lng: location.lng };
  if (geocodeCache.size >= GEOCODE_CACHE_MAX) {
    const oldest = geocodeCache.keys().next().value;
    if (oldest !== undefined) {
      geocodeCache.delete(oldest);
    }
  }
  geocodeCache.set(normalized, point);
  response.json(point);
});

placesProxyRouter.post('/autocomplete', async (request, response) => {
  if (!(await lookupCaller(request, response))) {
    return;
  }
  const key = process.env['GOOGLE_MAPS_API_KEY'] ?? '';
  if (key === '') {
    response.status(503).json({ error: 'Places API not configured' });
    return;
  }
  const body = request.body as { query?: unknown; sessionToken?: unknown };
  if (typeof body.query !== 'string' || body.query.length === 0) {
    response.json({ suggestions: [] });
    return;
  }
  const fieldMask = 'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text';
  const googleResponse = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify({
      input: body.query,
      sessionToken: typeof body.sessionToken === 'string' ? body.sessionToken : undefined,
      includedPrimaryTypes: ['street_address', 'route', 'premise', 'subpremise'],
    }),
  });
  if (!googleResponse.ok) {
    response.status(googleResponse.status).json({ error: 'Places upstream error' });
    return;
  }
  const data = (await googleResponse.json()) as {
    suggestions?: Array<{ placePrediction?: { placeId?: string; text?: { text?: string } } }>;
  };
  const suggestions = (data.suggestions ?? [])
    .map((entry) => {
      const placeId = entry.placePrediction?.placeId;
      const text = entry.placePrediction?.text?.text;
      if (typeof placeId !== 'string' || typeof text !== 'string') {
        return null;
      }
      return { placeId, text };
    })
    .filter((entry): entry is { placeId: string; text: string } => entry !== null);
  response.json({ suggestions });
});

placesProxyRouter.post('/details', async (request, response) => {
  if (!(await lookupCaller(request, response))) {
    return;
  }
  const key = process.env['GOOGLE_MAPS_API_KEY'] ?? '';
  if (key === '') {
    response.status(503).json({ error: 'Places API not configured' });
    return;
  }
  const body = request.body as { placeId?: unknown; sessionToken?: unknown };
  if (typeof body.placeId !== 'string' || body.placeId.length === 0) {
    response.status(400).json({ error: 'placeId required' });
    return;
  }
  const url = new URL(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(body.placeId)}`
  );
  if (typeof body.sessionToken === 'string') {
    url.searchParams.set('sessionToken', body.sessionToken);
  }
  const googleResponse = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'addressComponents',
    },
  });
  if (!googleResponse.ok) {
    response.status(googleResponse.status).json({ error: 'Places upstream error' });
    return;
  }
  const data = (await googleResponse.json()) as {
    addressComponents?: Array<{ types?: string[]; longText?: string; shortText?: string }>;
  };
  response.json({ addressComponents: data.addressComponents ?? [] });
});

placesProxyRouter.post('/embed-url', async (request, response) => {
  if ((await placesCaller(request, response)) === null) {
    return;
  }
  const key = process.env['GOOGLE_MAPS_BROWSER_KEY'] ?? '';
  if (key === '') {
    response.status(503).json({ error: 'Maps browser key not configured' });
    return;
  }
  const body = request.body as { address?: unknown };
  if (typeof body.address !== 'string' || body.address.trim().length === 0) {
    response.status(400).json({ error: 'address required' });
    return;
  }
  const url = new URL('https://www.google.com/maps/embed/v1/place');
  url.searchParams.set('key', key);
  url.searchParams.set('q', body.address);
  response.json({ url: url.toString() });
});
