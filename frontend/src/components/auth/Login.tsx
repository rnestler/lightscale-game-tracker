import type { JSX } from 'react';
import { useState, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { authClient } from '../../api/authClient.js';
import { startSocialSignIn } from '../../api/socialSignIn.js';
import { useSetupStatus } from '../../api/setupStatus.js';
import {
  authErrorMessage,
  getErrorMessage,
  isCancelledAuthError,
} from '../../utils/errorHandling.js';
import { VerifyEmailNotice } from './VerifyEmailNotice.js';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface LoginProperties {
  onSwitchToRegister: () => void;
}

function providerTitle(providers: string[], provider: string, label: string): string {
  if (providers.includes(provider)) {
    return label;
  }
  return `${label}: Not configured`;
}

export function Login({ onSwitchToRegister }: LoginProperties): JSX.Element {
  const { signIn, verifyTwoFactor } = useAuth();
  const setupStatus = useSetupStatus();
  const [email, setEmail] = useState('');
  const passwordRef = useRef('');
  const [passwordDisplay, setPasswordDisplay] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);

  const resetPasswordFields = (): void => {
    passwordRef.current = '';
    setPasswordDisplay('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const currentPassword = passwordRef.current;
    try {
      const result = await signIn(email, currentPassword);
      resetPasswordFields();

      const resultObj = result as {
        data?: { twoFactorRedirect?: boolean };
        twoFactorRedirect?: boolean;
        emailVerificationRequired?: boolean;
      };
      if (resultObj.emailVerificationRequired === true) {
        setPendingVerificationEmail(email);
        setIsLoading(false);
        return;
      }
      const hasTwoFactorRedirect =
        resultObj.data?.twoFactorRedirect === true || resultObj.twoFactorRedirect === true;
      if (hasTwoFactorRedirect) {
        setRequiresTwoFactor(true);
        setIsLoading(false);
      } else {
        window.location.href = '/app';
      }
    } catch (err) {
      resetPasswordFields();
      setError(getErrorMessage(err, 'Authentication failed'));
      setIsLoading(false);
    }
  };

  const submitTwoFactorCode = async (value: string): Promise<void> => {
    setError(null);
    setIsLoading(true);

    try {
      await verifyTwoFactor(value);
      setTwoFactorCode('');
      window.location.href = '/app';
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid verification code'));
      setIsLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await submitTwoFactorCode(twoFactorCode);
  };

  const handlePasskeySignIn = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await authClient.signIn.passkey({
        autoFill: false,
      });

      if (result.error) {
        if (isCancelledAuthError(result.error)) {
          setError('Passkey authentication was cancelled.');
        } else {
          setError(authErrorMessage(result.error, 'Passkey authentication failed'));
        }
        return;
      }

      window.location.href = '/app';
    } catch (err) {
      setError(
        isCancelledAuthError(err)
          ? 'Passkey authentication was cancelled.'
          : 'Passkey authentication failed'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (pendingVerificationEmail) {
    return (
      <div className="w-full">
        <VerifyEmailNotice
          email={pendingVerificationEmail}
          onBack={() => {
            setPendingVerificationEmail(null);
            setError(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-col gap-6">
        {requiresTwoFactor && (
          <div className="flex flex-col gap-2">
            <h2 className="text-xl md:text-2xl font-normal leading-tight text-foreground">
              Two-factor verification
            </h2>
            <p className="text-sm text-muted-foreground">
              {'Enter the 6‑digit code from your authenticator.'}
            </p>
          </div>
        )}

        {!requiresTwoFactor ? (
          <form
            onSubmit={(e) => {
              handleSubmit(e).catch(console.error);
            }}
            className="flex flex-col gap-5"
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                required
                disabled={isLoading}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={passwordDisplay}
                  onChange={(e) => {
                    const { value } = e.target;
                    passwordRef.current = value;
                    setPasswordDisplay(value);
                  }}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowPassword(!showPassword);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide' : 'Show'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-border bg-secondary p-3 text-sm text-foreground">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="bg-primary text-primary-foreground hover:opacity-90 focus-visible:outline-primary"
              size="lg"
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>

            <button
              type="button"
              onClick={() => {
                window.location.href = '/forgot-password';
              }}
              disabled={isLoading}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Forgot password?
            </button>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 border-t border-border" />
                <span className="text-sm text-muted-foreground">Or continue with</span>
                <div className="flex-1 border-t border-border" />
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    handlePasskeySignIn().catch(console.error);
                  }}
                  disabled={isLoading}
                  className="bg-secondary text-foreground hover:opacity-90 focus-visible:outline-primary"
                  size="lg"
                >
                  Sign in with passkey
                </Button>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      startSocialSignIn('google');
                    }}
                    disabled={isLoading || !setupStatus.socialProviders.includes('google')}
                    title={providerTitle(setupStatus.socialProviders, 'google', 'Google')}
                    className="relative flex-1 min-w-0 inline-flex items-center justify-center gap-2 bg-secondary text-foreground hover:opacity-90 focus-visible:outline-primary disabled:cursor-not-allowed [&:disabled>svg]:grayscale [&:disabled>svg]:opacity-50"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span className="truncate">Google</span>
                    {!setupStatus.socialProviders.includes('google') && (
                      <span className="absolute -top-2 right-2 rounded-full border border-border bg-background px-1.5 text-[9px] font-bold uppercase tracking-wider leading-relaxed text-muted-foreground">
                        Not configured
                      </span>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      startSocialSignIn('apple');
                    }}
                    disabled={isLoading || !setupStatus.socialProviders.includes('apple')}
                    title={providerTitle(setupStatus.socialProviders, 'apple', 'Apple')}
                    className="relative flex-1 min-w-0 inline-flex items-center justify-center gap-2 bg-secondary text-foreground hover:opacity-90 focus-visible:outline-primary disabled:cursor-not-allowed [&:disabled>svg]:grayscale [&:disabled>svg]:opacity-50"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
                      />
                    </svg>
                    <span className="truncate">Apple</span>
                    {!setupStatus.socialProviders.includes('apple') && (
                      <span className="absolute -top-2 right-2 rounded-full border border-border bg-background px-1.5 text-[9px] font-bold uppercase tracking-wider leading-relaxed text-muted-foreground">
                        Not configured
                      </span>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      startSocialSignIn('microsoft');
                    }}
                    disabled={isLoading || !setupStatus.socialProviders.includes('microsoft')}
                    title={providerTitle(setupStatus.socialProviders, 'microsoft', 'Microsoft')}
                    className="relative flex-1 min-w-0 inline-flex items-center justify-center gap-2 bg-secondary text-foreground hover:opacity-90 focus-visible:outline-primary disabled:cursor-not-allowed [&:disabled>svg]:grayscale [&:disabled>svg]:opacity-50"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                      <path fill="#F25022" d="M1 1h10v10H1z" />
                      <path fill="#7FBA00" d="M13 1h10v10H13z" />
                      <path fill="#00A4EF" d="M1 13h10v10H1z" />
                      <path fill="#FFB900" d="M13 13h10v10H13z" />
                    </svg>
                    <span className="truncate">Microsoft</span>
                    {!setupStatus.socialProviders.includes('microsoft') && (
                      <span className="absolute -top-2 right-2 rounded-full border border-border bg-background px-1.5 text-[9px] font-bold uppercase tracking-wider leading-relaxed text-muted-foreground">
                        Not configured
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              onClick={onSwitchToRegister}
              disabled={isLoading}
              className="text-foreground hover:opacity-80 focus-visible:outline-primary"
            >
              {"Don't have an account? Sign up"}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              handleTwoFactorSubmit(e).catch(console.error);
            }}
            className="flex flex-col gap-5"
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="twoFactorCode" className="text-sm font-medium text-foreground">
                Verification Code
              </label>
              <Input
                id="twoFactorCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                value={twoFactorCode}
                onChange={(e) => {
                  const numericOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setTwoFactorCode(numericOnly);
                  if (numericOnly.length === 6 && !isLoading) {
                    submitTwoFactorCode(numericOnly).catch(console.error);
                  }
                }}
                placeholder="000000"
                maxLength={6}
                required
                disabled={isLoading}
                autoFocus
                autoComplete="one-time-code"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-border bg-secondary p-3 text-sm text-foreground">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="bg-primary text-primary-foreground hover:opacity-90 focus-visible:outline-primary"
              size="lg"
            >
              {isLoading ? 'Verifying…' : 'Verify'}
            </Button>

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                onClick={() => {
                  setRequiresTwoFactor(false);
                  setTwoFactorCode('');
                  setError(null);
                  resetPasswordFields();
                }}
                disabled={isLoading}
                className="h-10 rounded-lg bg-transparent px-6 text-sm font-medium text-foreground hover:bg-secondary hover:text-secondary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Back to sign in
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
