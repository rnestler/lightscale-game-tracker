import type { CSSProperties, JSX } from 'react';
import { useState } from 'react';
import { apiBaseUrl } from '../config/apiConfig.js';
import { ShieldCheck, MailCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

type InquiryKind = 'access' | 'rectification' | 'erasure';

interface GuestPrivacyInquiryProps {
  appTitle: string;
  logoUrl: string;
  backgroundUrl: string;
}

export function GuestPrivacyInquiry({
  appTitle,
  logoUrl,
  backgroundUrl,
}: GuestPrivacyInquiryProps): JSX.Element {
  const [kind, setKind] = useState<InquiryKind>('access');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/privacy/inquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, email, attributes: {} }),
      });
      if (response.ok) {
        setSubmitted(true);
      } else {
        setError('Could not submit your request. Please try again.');
      }
    } catch {
      setError('Could not submit your request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const backgroundStyle: CSSProperties =
    backgroundUrl !== ''
      ? {
          backgroundImage: `linear-gradient(to bottom, color-mix(in oklch, var(--foreground), transparent 70%), color-mix(in oklch, var(--foreground), transparent 80%)), url('${backgroundUrl}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : {};

  return (
    <div className="min-h-screen bg-background text-foreground" style={backgroundStyle}>
      <header className="fixed inset-x-0 top-0 z-50 h-14 flex items-center gap-2.5 px-4 sm:px-6 lg:px-8 xl:px-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <a
          href="/"
          className="flex-1 min-w-0 flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          {logoUrl !== '' && (
            <img src={logoUrl} alt="" className="h-6 w-6 object-contain shrink-0" />
          )}
          <span className="min-w-0 truncate text-sm lg:text-base font-semibold uppercase tracking-wide text-foreground">
            {appTitle}
          </span>
        </a>
        <a
          href="/"
          className="shrink-0 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>←</span>
          <span className="hidden sm:inline">Back to site</span>
        </a>
      </header>

      <main className="pt-14 min-h-screen flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl">
          <div
            className="border border-border bg-background rounded-lg p-8 md:p-10 opacity-0 animate-fade-in"
            style={{ animationDelay: '0.1s' }}
          >
            <div className="flex flex-col gap-4">
              {(logoUrl !== '' || appTitle !== '') && (
                <div className="flex items-center gap-2.5 pb-5 border-b border-border">
                  {logoUrl !== '' && (
                    <img src={logoUrl} alt="" className="h-7 w-7 object-contain shrink-0" />
                  )}
                  {appTitle !== '' && (
                    <span className="min-w-0 truncate text-sm font-semibold uppercase tracking-wide text-foreground">
                      {appTitle}
                    </span>
                  )}
                </div>
              )}
              <div className="h-11 w-11 rounded-lg border border-border bg-secondary flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-foreground" />
              </div>
              <h1 className="text-3xl md:text-4xl font-light tracking-tight leading-tight text-foreground">
                Data protection request
              </h1>
              <p className="text-sm md:text-base text-muted-foreground leading-normal">
                Request access to, correction of, or erasure of your personal data. We will email
                you to confirm before processing.
              </p>
            </div>

            {submitted ? (
              <div className="mt-8 rounded-lg border border-border bg-secondary p-4 flex items-start gap-3 opacity-0 animate-fade-in">
                <MailCheck className="h-5 w-5 text-foreground shrink-0 mt-0.5" />
                <p className="text-sm text-foreground leading-normal">
                  Please check your email to confirm your request.
                </p>
              </div>
            ) : (
              <form
                className="mt-8 flex flex-col gap-5 opacity-0 animate-fade-in"
                style={{ animationDelay: '0.2s' }}
                onSubmit={(event) => {
                  submit(event).catch(() => undefined);
                }}
              >
                <div className="flex flex-col gap-2">
                  <label htmlFor="privacy-kind" className="text-sm font-medium text-foreground">
                    Type
                  </label>
                  <select
                    id="privacy-kind"
                    value={kind}
                    onChange={(event) => {
                      setKind(event.target.value as InquiryKind);
                    }}
                    disabled={isLoading}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="access">Access</option>
                    <option value="rectification">Rectification</option>
                    <option value="erasure">Erasure</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="privacy-email" className="text-sm font-medium text-foreground">
                    Your email
                  </label>
                  <Input
                    id="privacy-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    disabled={isLoading}
                    onChange={(e) => {
                      setEmail(e.target.value);
                    }}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                {error !== null && (
                  <div className="rounded-lg border border-border bg-secondary p-3 text-sm text-foreground">
                    {error}
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={isLoading}
                  size="lg"
                  className="bg-primary text-primary-foreground hover:opacity-90 focus-visible:outline-primary"
                >
                  Submit request
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
