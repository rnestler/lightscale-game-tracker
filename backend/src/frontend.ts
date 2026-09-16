import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FRONTEND_DIRECTORY = join(PROJECT_DIRECTORY, 'frontend');
const BUILD_DIRECTORY = join(FRONTEND_DIRECTORY, 'dist');
const INLINE_SCRIPT = /<script\b(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;

const ANALYTICS_SCRIPT_ORIGINS = ['https://www.googletagmanager.com'];
const ANALYTICS_CONNECT_ORIGINS = [
  'https://www.googletagmanager.com',
  'https://www.google-analytics.com',
  'https://*.google-analytics.com',
  'https://*.analytics.google.com',
];

export interface BuiltFrontend {
  indexHtml: string;
  contentSecurityPolicy: string;
}

async function containsEntry(directory: string, name: string): Promise<boolean> {
  const entries = await readdir(directory);
  return entries.includes(name);
}

function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = [];
  for (const match of html.matchAll(INLINE_SCRIPT)) {
    const digest = createHash('sha256').update(match[1]).digest('base64');
    hashes.push(`'sha256-${digest}'`);
  }
  return hashes;
}

function contentSecurityPolicy(html: string, analytics: boolean): string {
  const scriptSources = [
    "'self'",
    ...inlineScriptHashes(html),
    'https://maps.googleapis.com',
    ...(analytics ? ANALYTICS_SCRIPT_ORIGINS : []),
  ];
  const connectSources = [
    "'self'",
    'https://*.googleapis.com',
    ...(analytics ? ANALYTICS_CONNECT_ORIGINS : []),
  ];
  return [
    "default-src 'none'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob:",
    `connect-src ${connectSources.join(' ')}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    'frame-src https://www.google.com',
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export async function loadBuiltFrontend(analytics: boolean): Promise<BuiltFrontend | null> {
  const built =
    (await containsEntry(PROJECT_DIRECTORY, 'frontend')) &&
    (await containsEntry(FRONTEND_DIRECTORY, 'dist'));
  if (!built) {
    return null;
  }
  const indexHtml = await readFile(join(BUILD_DIRECTORY, 'index.html'), 'utf8');
  return { indexHtml, contentSecurityPolicy: contentSecurityPolicy(indexHtml, analytics) };
}

function isFrontendNavigation(request: Request): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return false;
  }
  if (request.path === '/') {
    return true;
  }
  const underApi = request.path === '/api' || request.path.startsWith('/api/');
  return !underApi && request.accepts(['json', 'html']) === 'html';
}

export function mountBuiltFrontend(app: Express, frontend: BuiltFrontend): void {
  app.use(
    express.static(BUILD_DIRECTORY, {
      index: false,
      redirect: false,
      setHeaders: (response, filePath): void => {
        if (filePath.endsWith('.html')) {
          response.setHeader('Content-Security-Policy', frontend.contentSecurityPolicy);
        }
      },
    })
  );
  app.use((request: Request, response: Response, next: NextFunction): void => {
    if (!isFrontendNavigation(request)) {
      next();
      return;
    }
    response.setHeader('Content-Security-Policy', frontend.contentSecurityPolicy);
    response.setHeader('Cache-Control', 'no-cache');
    response.type('html').send(frontend.indexHtml);
  });
}
