function configuredAddress(name: string, value: string): URL {
  if (!URL.canParse(value)) {
    throw new Error(
      `Links and passkeys need the public address of the software, but ${name} "${value}" is not a full URL: Set BETTER_AUTH_URL in .env, and CORS_ORIGIN when the frontend is served separately`
    );
  }
  return new URL(value);
}

export function backendAddress(): URL {
  return configuredAddress('BETTER_AUTH_URL', process.env.BETTER_AUTH_URL ?? '');
}

export function publicAddress(): URL {
  const corsOrigin = process.env.CORS_ORIGIN ?? '';
  return corsOrigin === '' ? backendAddress() : configuredAddress('CORS_ORIGIN', corsOrigin);
}

export function backendLink(path: string): string {
  return `${backendAddress().origin}${path}`;
}

export function publicLink(path: string): string {
  return `${publicAddress().origin}${path}`;
}
