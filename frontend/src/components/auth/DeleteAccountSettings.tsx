import type { JSX } from 'react';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { getErrorMessage } from '../../utils/errorHandling.js';

const CONFIRM_WORD = 'DELETE';

export function DeleteAccountSettings(): JSX.Element {
  const { deleteAccount } = useAuth();
  const [confirmation, setConfirmation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await deleteAccount();
      window.location.href = '/';
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete account. Please try again.'));
      setIsLoading(false);
    }
  };

  const confirmed = confirmation.trim() === CONFIRM_WORD;

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
          <h3 className="text-lg font-semibold text-destructive-text">Delete account</h3>
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and all associated data.
          </p>
        </div>

        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground">
          This action cannot be undone. Your account and data will be removed for good.
        </div>

        {error && (
          <div className="rounded-md border border-border bg-secondary p-3 text-sm text-foreground">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="deleteConfirmation" className="text-sm font-medium text-foreground">
            Type DELETE to confirm
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
            placeholder={CONFIRM_WORD}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-destructive focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !confirmed}
          className="h-10 rounded-md bg-destructive px-6 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Deleting…' : 'Delete my account'}
        </button>
      </form>
    </div>
  );
}
