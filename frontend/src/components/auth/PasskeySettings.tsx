import type { JSX } from 'react';
import { useState } from 'react';
import { authClient } from '../../api/authClient.js';
import {
  authErrorMessage,
  getErrorMessage,
  isCancelledAuthError,
} from '../../utils/errorHandling.js';

export function PasskeySettings(): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRegisterPasskey = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      const result = await authClient.passkey.addPasskey({
        name: 'Device passkey',
        authenticatorAttachment: 'cross-platform',
      });

      if (result.error) {
        if (isCancelledAuthError(result.error)) {
          setError('Passkey registration was cancelled.');
        } else {
          setError(authErrorMessage(result.error, 'Passkey registration failed'));
        }
      } else {
        setSuccess('Passkey registered successfully! You can now use it to sign in.');
      }
    } catch (err) {
      if (isCancelledAuthError(err)) {
        setError('Passkey registration was cancelled.');
      } else {
        const errorMessage = getErrorMessage(err, 'Passkey registration failed');
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-6 lg:gap-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">Passkey Settings</h2>
          <p className="text-sm text-muted-foreground">
            {
              "Register a passkey to enable passwordless sign-in using your device's biometric authentication or security key."
            }
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-border bg-secondary p-3 text-sm text-foreground">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-md border border-border bg-secondary p-3 text-sm text-foreground">
            {success}
          </div>
        )}

        <div className="flex">
          <button
            type="button"
            onClick={(): void => {
              handleRegisterPasskey().catch((err) => {
                console.error('Passkey registration error', err);
              });
            }}
            disabled={isLoading}
            className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Registering...' : 'Register Passkey'}
          </button>
        </div>
      </div>
    </div>
  );
}
