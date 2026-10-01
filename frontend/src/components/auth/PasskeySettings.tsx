import { i18n } from '../../i18n/text';
import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { authClient } from '../../api/authClient.js';
import {
  authErrorMessage,
  getErrorMessage,
  isCancelledAuthError,
} from '../../utils/errorHandling.js';

interface RegisteredPasskey {
  id: string;
  name?: string | null;
  createdAt: string | Date;
}

export function PasskeySettings(): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [passkeys, setPasskeys] = useState<RegisteredPasskey[]>([]);

  const loadPasskeys = useCallback(async (): Promise<void> => {
    const result = await authClient.passkey.listUserPasskeys();
    if (result.error) {
      setError(authErrorMessage(result.error, i18n.chrome.passkeysUnavailable));
      return;
    }
    setPasskeys(result.data);
  }, []);

  useEffect(() => {
    loadPasskeys().catch((err: unknown) => {
      console.error('Failed to load passkeys', err);
    });
  }, [loadPasskeys]);

  const handleRemovePasskey = async (id: string): Promise<void> => {
    setError(null);
    setSuccess(null);
    const result = await authClient.passkey.deletePasskey({ id });
    if (result.error) {
      setError(authErrorMessage(result.error, i18n.chrome.passkeyRemoveFailed));
      return;
    }
    await loadPasskeys();
  };

  const handleRegisterPasskey = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      const result = await authClient.passkey.addPasskey({
        name: i18n.chrome.passkeyDeviceName,
        authenticatorAttachment: 'cross-platform',
      });

      if (result.error) {
        if (isCancelledAuthError(result.error)) {
          setError(i18n.chrome.passkeyRegistrationCancelled);
        } else {
          setError(authErrorMessage(result.error, i18n.chrome.passkeyRegistrationFailed));
        }
      } else {
        setSuccess(i18n.chrome.passkeyRegisteredSuccess);
        await loadPasskeys();
      }
    } catch (err) {
      if (isCancelledAuthError(err)) {
        setError(i18n.chrome.passkeyRegistrationCancelled);
      } else {
        const errorMessage = getErrorMessage(err, i18n.chrome.passkeyRegistrationFailed);
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
          <h2 className="text-lg font-semibold text-foreground">
            {i18n.chrome.passkeySettingsTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{i18n.chrome.passkeySettingsDescription}</p>
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

        {passkeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">{i18n.chrome.passkeyListEmpty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
            {passkeys.map((passkey) => (
              <li key={passkey.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {passkey.name ?? i18n.chrome.passkeyDeviceName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(passkey.createdAt).toLocaleDateString(i18n.locale)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(): void => {
                    handleRemovePasskey(passkey.id).catch((err: unknown) => {
                      console.error('Passkey removal error', err);
                    });
                  }}
                  className="h-8 shrink-0 rounded-md px-3 text-sm font-medium text-foreground hover:bg-secondary"
                >
                  {i18n.chrome.passkeyRemove}
                </button>
              </li>
            ))}
          </ul>
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
            {isLoading ? i18n.chrome.registeringIndicator : i18n.chrome.registerPasskey}
          </button>
        </div>
      </div>
    </div>
  );
}
