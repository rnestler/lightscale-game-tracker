import { i18n } from '../../i18n/text';
import type { JSX } from 'react';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { getErrorMessage } from '../../utils/errorHandling.js';

export function DeleteAccountSettings(): JSX.Element {
  const confirmWord = i18n.chrome.deleteAccountConfirmWord;
  const { deleteAccount } = useAuth();
  const [confirmation, setConfirmation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const outcome = await deleteAccount();
      window.location.href =
        outcome === 'deleted'
          ? '/'
          : `/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
    } catch (err) {
      setError(getErrorMessage(err, i18n.chrome.deleteAccountFailed));
      setIsLoading(false);
    }
  };

  const confirmed = confirmation.trim() === confirmWord;

  return (
    <div>
      <form
        onSubmit={(e) => {
          handleSubmit(e).catch((err) => {
            console.error('Form submission error', err);
          });
        }}
        className="flex flex-col gap-6 lg:gap-8"
      >
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold text-destructive-text">
            {i18n.chrome.deleteAccountTitle}
          </h3>
          <p className="text-sm text-muted-foreground">{i18n.chrome.deleteAccountDescription}</p>
        </div>

        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground">
          {i18n.chrome.deleteAccountWarning}
        </div>

        {error && (
          <div className="rounded-md border border-border bg-secondary p-3 text-sm text-foreground">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="deleteConfirmation" className="text-sm font-medium text-foreground">
            {i18n.chrome.deleteAccountConfirmLabel}
          </label>
          <input
            id="deleteConfirmation"
            type="text"
            value={confirmation}
            onChange={(e) => {
              setConfirmation(e.target.value);
            }}
            disabled={isLoading}
            autoComplete="off"
            placeholder={confirmWord}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-destructive focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !confirmed}
          className="h-10 rounded-md bg-destructive px-6 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? i18n.chrome.deletingAccount : i18n.chrome.deleteAccountButton}
        </button>
      </form>
    </div>
  );
}
