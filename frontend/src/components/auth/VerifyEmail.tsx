import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { authClient } from '../../api/authClient.js';
import { Button } from '../ui/button';

function readToken(): string | null {
  return new URLSearchParams(window.location.search).get('token');
}

export function VerifyEmail(): JSX.Element {
  const [status, setStatus] = useState<'verifying' | 'verified' | 'error'>(() =>
    readToken() === null ? 'error' : 'verifying'
  );

  useEffect(() => {
    const token = readToken();
    if (token === null) {
      return;
    }
    authClient
      .verifyEmail({ query: { token } })
      .then((result) => {
        setStatus((result as { error?: unknown }).error ? 'error' : 'verified');
      })
      .catch(() => {
        setStatus('error');
      });
  }, []);

  if (status === 'verified') {
    return (
      <div className="flex flex-col gap-6 text-center">
        <div className="rounded-lg border border-border bg-secondary p-3 text-sm text-foreground">
          Your email address is verified.
        </div>
        <Button
          type="button"
          onClick={() => {
            window.location.href = '/app';
          }}
          className="bg-primary text-primary-foreground hover:opacity-90 focus-visible:outline-primary"
          size="lg"
        >
          Continue
        </Button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-6 text-center">
        <div className="rounded-lg border border-border bg-secondary p-3 text-sm text-foreground">
          This verification link is invalid or has expired.
        </div>
        <Button
          type="button"
          onClick={() => {
            window.location.href = '/login';
          }}
          className="bg-primary text-primary-foreground hover:opacity-90 focus-visible:outline-primary"
          size="lg"
        >
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center py-6">
      <div className="h-8 w-8 rounded-full border-2 border-border border-t-primary animate-spin" />
      <p className="text-sm text-muted-foreground">Verifying your email…</p>
    </div>
  );
}
