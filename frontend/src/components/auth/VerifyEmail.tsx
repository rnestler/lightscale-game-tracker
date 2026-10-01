import { i18n } from '../../i18n/text';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { authClient } from '../../api/authClient.js';
import { openSignIn } from '../../utils/recordNavigation.js';
import { Button } from '../ui/button';

function readToken(): string | null {
  return new URLSearchParams(window.location.search).get('token');
}

const verifications = new Map<string, Promise<boolean>>();

function verifyOnce(token: string): Promise<boolean> {
  const pending = verifications.get(token);
  if (pending !== undefined) {
    return pending;
  }
  const verification = authClient
    .verifyEmail({ query: { token } })
    .then((result) => !(result as { error?: unknown }).error);
  verifications.set(token, verification);
  return verification;
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
    verifyOnce(token)
      .then((verified) => {
        setStatus(verified ? 'verified' : 'error');
      })
      .catch(() => {
        setStatus('error');
      });
  }, []);

  if (status === 'verified') {
    return (
      <div className="flex flex-col gap-6 text-center">
        <div className="rounded-lg border border-border bg-secondary p-3 text-sm text-foreground">
          {i18n.chrome.verifyEmailSucceeded}
        </div>
        <Button
          type="button"
          onClick={() => {
            window.location.href = '/app';
          }}
          className="bg-primary text-primary-foreground hover:opacity-90 focus-visible:outline-primary"
          size="lg"
        >
          {i18n.chrome.verifyEmailContinue}
        </Button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-6 text-center">
        <div className="rounded-lg border border-border bg-secondary p-3 text-sm text-foreground">
          {i18n.chrome.verifyEmailFailed}
        </div>
        <Button
          type="button"
          onClick={() => {
            openSignIn();
          }}
          className="bg-primary text-primary-foreground hover:opacity-90 focus-visible:outline-primary"
          size="lg"
        >
          {i18n.chrome.goToSignIn}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center py-6">
      <div className="h-8 w-8 rounded-full border-2 border-border border-t-primary animate-spin" />
      <p className="text-sm text-muted-foreground">{i18n.chrome.verifyingEmail}</p>
    </div>
  );
}
