import { i18n } from '../../i18n/text';
import type { JSX } from 'react';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { useSetupStatus } from '../../api/setupStatus.js';
import { getErrorMessage } from '../../utils/errorHandling.js';
import { Button } from '../ui/button';

interface VerifyEmailNoticeProperties {
  email: string;
  onBack: () => void;
}

export function VerifyEmailNotice({ email, onBack }: VerifyEmailNoticeProperties): JSX.Element {
  const { resendVerificationEmail } = useAuth();
  const setupStatus = useSetupStatus();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleResend = async (): Promise<void> => {
    setError(null);
    setStatus('sending');
    try {
      await resendVerificationEmail(email);
      setStatus('sent');
    } catch (err) {
      setStatus('idle');
      setError(getErrorMessage(err, i18n.chrome.verificationResendFailed));
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-foreground">
        <svg
          viewBox="0 0 24 24"
          width="26"
          height="26"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-xl md:text-2xl font-normal leading-tight text-foreground">
          {i18n.chrome.verifyEmailTitle}
        </h2>
        <p className="text-sm text-muted-foreground">
          {i18n.chrome.verifyEmailDescription}{' '}
          <span className="font-medium text-foreground">{email}</span>.
        </p>
      </div>

      {!setupStatus.emailDelivery && (
        <div className="rounded-lg border border-border bg-secondary p-3 text-sm text-foreground">
          {i18n.chrome.emailDeliveryNotConfigured}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-border bg-secondary p-3 text-sm text-foreground">
          {error}
        </div>
      )}

      {status === 'sent' && (
        <div className="rounded-lg border border-border bg-secondary p-3 text-sm text-foreground">
          {i18n.chrome.verificationResent}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {setupStatus.capabilities.emailVerification && (
          <Button
            type="button"
            onClick={() => {
              handleResend().catch(console.error);
            }}
            disabled={status === 'sending'}
            className="bg-primary text-primary-foreground hover:opacity-90 focus-visible:outline-primary"
            size="lg"
          >
            {status === 'sending'
              ? i18n.chrome.verificationResending
              : i18n.chrome.verificationResend}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="text-foreground hover:opacity-80 focus-visible:outline-primary"
        >
          {i18n.chrome.backToSignIn}
        </Button>
      </div>
    </div>
  );
}
