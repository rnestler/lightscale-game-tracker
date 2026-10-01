import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ENTRY = /^([A-Z][A-Z0-9_]*)="?([^"\n]*)"?$/gm;

function entries(content) {
  const values = new Map();
  for (const match of content.matchAll(ENTRY)) {
    values.set(match[1], match[2]);
  }
  return values;
}

function required(values, key) {
  const value = values.get(key);
  if (value === undefined) {
    throw new Error(`.env carries no ${key}`);
  }
  return value;
}

function withValue(content, key, value) {
  return content.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}="${value}"`);
}

function databaseUrl(values) {
  const user = encodeURIComponent(required(values, 'DB_USER'));
  const password = encodeURIComponent(required(values, 'DB_PASSWORD'));
  const host = required(values, 'DB_HOST');
  const port = required(values, 'DB_PORT');
  return `postgres://${user}:${password}@${host}:${port}/${required(values, 'DB_NAME')}`;
}

const GENERATED = [
  ['DB_PASSWORD', () => randomBytes(24).toString('base64url')],
  ['BETTER_AUTH_SECRET', () => randomBytes(32).toString('hex')],
  ['DATABASE_URL', databaseUrl],
];

export function completeEnvironment(packageRoot) {
  const environmentFile = path.join(packageRoot, '.env');
  if (!existsSync(environmentFile)) {
    copyFileSync(path.join(packageRoot, '.env.example'), environmentFile);
    console.log('Created .env from .env.example.');
  }
  let content = readFileSync(environmentFile, 'utf8');
  for (const [key, generate] of GENERATED) {
    const values = entries(content);
    if (required(values, key) === '') {
      content = withValue(content, key, generate(values));
      console.log(`Generated ${key} in .env.`);
    }
  }
  writeFileSync(environmentFile, content, { mode: 0o600 });
}
