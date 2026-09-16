import type { JSX } from 'react';
import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { getErrorMessage, isInvalidPasswordError } from '../../utils/errorHandling.js';
import { toDataURL } from 'qrcode';

export function TwoFactorSettings(): JSX.Element {
  const { enableTwoFactor, disableTwoFactor, verifyTwoFactor, session } = useAuth();
  const passwordRef = useRef('');
  const [passwordDisplay, setPasswordDisplay] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionUser = session?.user as
    { twoFactorEnabled?: boolean; twoFactorSecret?: string } | undefined;
  const [twoFactorOverride, setTwoFactorOverride] = useState<boolean | null>(null);
  const twoFactorEnabled =
    twoFactorOverride ??
    (sessionUser?.twoFactorEnabled === true || (sessionUser?.twoFactorSecret ?? '') !== '');
  const [twoFactorData, setTwoFactorData] = useState<{
    totpURI: string;
    backupCodes: string[];
  } | null>(null);
  const [isEnabling, setIsEnabling] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [qrCode, setQrCode] = useState<{ uri: string; url: string } | null>(null);
  const qrCodeDataUrl =
    qrCode !== null && qrCode.uri === twoFactorData?.totpURI ? qrCode.url : null;
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [revealedBackupCodes, setRevealedBackupCodes] = useState(new Set<number>());
  const [backupCodesAcknowledged, setBackupCodesAcknowledged] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const resetPasswordFields = (): void => {
    passwordRef.current = '';
    setPasswordDisplay('');
  };

  const copyBackupCode = async (code: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code);
    } catch (err) {
      console.error('Failed to copy code', err);
    }
  };

  const copyAllBackupCodes = async (): Promise<void> => {
    if (!twoFactorData?.backupCodes) {
      return;
    }
    try {
      await navigator.clipboard.writeText(twoFactorData.backupCodes.join('\n'));
    } catch (err) {
      console.error('Failed to copy codes', err);
    }
  };

  const handleEnable = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);

    const currentPassword = passwordRef.current;
    if (requiresPassword && !currentPassword) {
      setError('Password is required');
      return;
    }

    setIsLoading(true);
    setIsEnabling(true);

    try {
      const result = await enableTwoFactor(requiresPassword ? currentPassword : undefined);
      resetPasswordFields();

      const data = result.data as { totpURI?: string; backupCodes?: string[] } | undefined;
      if (data?.totpURI && data.backupCodes) {
        setTwoFactorData({
          totpURI: data.totpURI,
          backupCodes: data.backupCodes,
        });
        setNeedsVerification(true);
        setRequiresPassword(false);
        setIsLoading(false);
        setIsEnabling(false);
      } else {
        setTwoFactorOverride(true);
        setError(null);
        setIsLoading(false);
        setIsEnabling(false);
      }
    } catch (err) {
      resetPasswordFields();

      if (isInvalidPasswordError(err)) {
        if (requiresPassword) {
          setError('Invalid password. Please try again.');
        } else {
          setRequiresPassword(true);
          setError('Password is required to enable two-factor authentication');
        }
        setIsLoading(false);
      } else {
        setError(getErrorMessage(err, 'Failed to enable two-factor authentication'));
        setIsLoading(false);
        setIsEnabling(false);
        console.error('Failed to enable two-factor authentication', err);
      }
    }
  };

  const handleDisable = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);

    const currentPassword = passwordRef.current;
    if (requiresPassword && !currentPassword) {
      setError('Password is required');
      return;
    }

    setIsLoading(true);
    setIsDisabling(true);

    try {
      await disableTwoFactor(requiresPassword ? currentPassword : undefined);
      resetPasswordFields();

      setTwoFactorData(null);
      setTwoFactorOverride(false);
      setRequiresPassword(false);
      setIsLoading(false);
      setIsDisabling(false);
    } catch (err) {
      resetPasswordFields();

      if (isInvalidPasswordError(err)) {
        if (requiresPassword) {
          setError('Invalid password. Please try again.');
        } else {
          setRequiresPassword(true);
          setError('Password is required to disable two-factor authentication');
        }
        setIsLoading(false);
      } else {
        setError(getErrorMessage(err, 'Failed to disable two-factor authentication'));
        setIsLoading(false);
        setIsDisabling(false);
        console.error('Failed to disable two-factor authentication', err);
      }
    }
  };

  const submitVerificationCode = async (value: string): Promise<void> => {
    setError(null);
    setIsLoading(true);

    try {
      await verifyTwoFactor(value);
      setTwoFactorOverride(true);
      setNeedsVerification(false);
      setVerificationCode('');
      if (backupCodesAcknowledged) {
        setTwoFactorData(null);
        setRevealedBackupCodes(new Set());
        setBackupCodesAcknowledged(false);
      }
    } catch (err) {
      const errorMessage = getErrorMessage(err, 'Invalid verification code');
      setError(errorMessage);
      console.error('Failed to verify two-factor code', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await submitVerificationCode(verificationCode);
  };

  useEffect(() => {
    const uri = twoFactorData?.totpURI;
    if (uri === undefined) {
      return;
    }
    toDataURL(uri, { width: 200, margin: 1 })
      .then((url: string) => {
        setQrCode({ uri, url });
      })
      .catch((err: unknown) => {
        console.error('Failed to generate QR code', err);
      });
  }, [twoFactorData]);

  if (twoFactorData) {
    return (
      <div>
        <div className="flex flex-col gap-6 lg:gap-8">
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-foreground">
              {needsVerification ? 'Verify Setup' : 'Setup Complete'}
            </h3>
            <p className="text-sm text-muted-foreground">
              Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>
            <div className="flex justify-start items-center p-4 lg:p-6 bg-card border border-border rounded-md min-h-[200px]">
              {qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt="2FA QR Code" className="max-w-full h-auto" />
              ) : (
                <div className="text-sm text-muted-foreground">Generating QR code...</div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Backup Codes</p>
                {revealedBackupCodes.size === twoFactorData.backupCodes.length && (
                  <button
                    type="button"
                    onClick={() => {
                      copyAllBackupCodes().catch(console.error);
                    }}
                    className="text-xs text-primary-text hover:underline"
                  >
                    Copy all
                  </button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Save these codes in a safe place. You can use them to access your account if you
                lose your device. <strong>Do not share screenshots of these codes.</strong>
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mt-2">
                {twoFactorData.backupCodes.map((code, index) => {
                  const isRevealed = revealedBackupCodes.has(index);
                  return (
                    <div
                      key={index}
                      className="p-2 lg:p-3 bg-secondary border border-border rounded-md text-xs lg:text-sm font-mono text-center text-foreground relative group"
                    >
                      {isRevealed ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="flex-1">{code}</span>
                          <button
                            type="button"
                            onClick={() => {
                              copyBackupCode(code).catch(console.error);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-primary-text hover:text-primary-text/80"
                            title="Copy code"
                          >
                            📋
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setRevealedBackupCodes((prev) => new Set(prev).add(index));
                          }}
                          className="w-full h-full text-muted-foreground hover:text-foreground transition-colors"
                        >
                          ••••••
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {revealedBackupCodes.size === twoFactorData.backupCodes.length &&
                !backupCodesAcknowledged && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setBackupCodesAcknowledged(true);
                      }}
                      className="h-8 px-4 rounded-md bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      {"I've saved my backup codes"}
                    </button>
                  </div>
                )}
            </div>
          </div>

          {needsVerification && (
            <form
              onSubmit={(e) => {
                handleVerifyCode(e).catch((err) => {
                  console.error('Form submission error', err);
                });
              }}
              className="flex flex-col gap-5"
            >
              <div className="flex flex-col gap-2">
                <label htmlFor="verificationCode" className="text-sm font-medium text-foreground">
                  Enter Verification Code
                </label>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code from your authenticator app to complete setup
                </p>
                <input
                  id="verificationCode"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  value={verificationCode}
                  onChange={(e) => {
                    const numericOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setVerificationCode(numericOnly);
                    if (numericOnly.length === 6 && !isLoading) {
                      submitVerificationCode(numericOnly).catch((err) => {
                        console.error('Verification error', err);
                      });
                    }
                  }}
                  placeholder="000000"
                  maxLength={6}
                  required
                  disabled={isLoading}
                  autoFocus
                  autoComplete="one-time-code"
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {error && (
                <div className="rounded-md border border-border bg-secondary p-3 text-sm text-foreground">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Verifying...' : 'Verify and Enable 2FA'}
              </button>
            </form>
          )}

          {!needsVerification && (
            <button
              type="button"
              onClick={() => {
                setTwoFactorData(null);
                resetPasswordFields();
                setError(null);
                setVerificationCode('');
                setRequiresPassword(false);
                setRevealedBackupCodes(new Set());
                setBackupCodesAcknowledged(false);
              }}
              className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Done
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-6 lg:gap-8">
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold text-foreground">Two-Factor Authentication</h3>
          <p className="text-sm text-muted-foreground">
            Add an extra layer of security to your account by requiring a verification code from
            your authenticator app.
          </p>
          {twoFactorEnabled && (
            <div className="rounded-md border border-border bg-secondary p-3 mt-2">
              <p className="text-sm text-foreground">2FA is currently enabled</p>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-border bg-secondary p-3 text-sm text-foreground">
            {error}
          </div>
        )}

        {!isDisabling && !twoFactorEnabled && (
          <form
            onSubmit={(e) => {
              handleEnable(e).catch((err) => {
                console.error('Form submission error', err);
              });
            }}
            className="flex flex-col gap-5"
          >
            {requiresPassword ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="enablePassword" className="text-sm font-medium text-foreground">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="enablePassword"
                    type={showPassword ? 'text' : 'password'}
                    value={passwordDisplay}
                    onChange={(e) => {
                      const { value } = e.target;
                      passwordRef.current = value;
                      setPasswordDisplay(value);
                    }}
                    required
                    disabled={isLoading}
                    placeholder="Enter your password to enable 2FA"
                    autoComplete="current-password"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
            ) : null}
            <div className="flex">
              <button
                type="submit"
                disabled={isLoading}
                className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Enabling...' : 'Enable Two-Factor Authentication'}
              </button>
            </div>
          </form>
        )}

        {isDisabling && (
          <form
            onSubmit={(e) => {
              handleDisable(e).catch((err) => {
                console.error('Form submission error', err);
              });
            }}
            className="flex flex-col gap-5"
          >
            {requiresPassword ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="disablePassword" className="text-sm font-medium text-foreground">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="disablePassword"
                    type={showPassword ? 'text' : 'password'}
                    value={passwordDisplay}
                    onChange={(e) => {
                      const { value } = e.target;
                      passwordRef.current = value;
                      setPasswordDisplay(value);
                    }}
                    required
                    disabled={isLoading}
                    placeholder="Enter your password to disable 2FA"
                    autoComplete="current-password"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
            ) : null}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsDisabling(false);
                  resetPasswordFields();
                  setError(null);
                  setRequiresPassword(false);
                }}
                disabled={isLoading}
                className="h-10 px-4 rounded-md bg-transparent text-sm font-medium text-foreground hover:bg-secondary hover:text-secondary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="h-10 px-4 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Disabling...' : 'Disable 2FA'}
              </button>
            </div>
          </form>
        )}

        {!isEnabling && !isDisabling && twoFactorEnabled && (
          <div className="flex">
            <button
              type="button"
              onClick={() => {
                setIsDisabling(true);
                setError(null);
                setRequiresPassword(false);
                resetPasswordFields();
              }}
              className="h-10 px-4 rounded-md bg-transparent text-sm font-medium text-foreground hover:bg-secondary hover:text-secondary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Disable Two-Factor Authentication
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
