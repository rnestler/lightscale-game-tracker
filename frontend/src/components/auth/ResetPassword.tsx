import { i18n } from '../../i18n/text';
import type { JSX } from 'react';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { authClient } from '../../api/authClient.js';
import { navigateToPath, openSignIn } from '../../utils/recordNavigation.js';
import { getErrorMessage } from '../../utils/errorHandling.js';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const MIN_PASSWORD_LENGTH = 10;

function readResetToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  if (params.get('error') !== null) {
    return null;
  }
  return params.get('token');
}

export function ResetPassword(): JSX.Element {
  const [token] = useState<string | null>(() => readResetToken());
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);

    if (token === null) {
      setError(i18n.chrome.resetPasswordInvalidLink);
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(i18n.chrome.passwordTooShort);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(i18n.chrome.passwordsDoNotMatch);
      return;
    }

    setIsLoading(true);
    try {
      const result = await authClient.resetPassword({ newPassword, token });
      if (result.error) {
        setError(i18n.chrome.resetPasswordFailed);
      } else {
        setDone(true);
      }
    } catch (err) {
      setError(getErrorMessage(err, i18n.chrome.resetPasswordFailed));
      console.error('Failed to reset password', err);
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'h-10 w-full rounded-lg border border-border bg-background px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const toggleClass =
    'absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors text-sm';

  if (done) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-lg border border-border bg-secondary p-3 text-sm text-foreground">
          {i18n.chrome.resetPasswordSuccess}
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

  if (token === null) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-lg border border-border bg-secondary p-3 text-sm text-foreground">
          {i18n.chrome.resetPasswordInvalidLink}
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            navigateToPath('/forgot-password');
          }}
          className="text-foreground hover:opacity-80 focus-visible:outline-primary"
        >
          {i18n.chrome.forgotPasswordTitle}
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        handleSubmit(e).catch(console.error);
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="newPassword" className="text-sm font-medium text-foreground">
          {i18n.chrome.newPasswordLabel}
        </label>
        <div className="relative">
          <Input
            id="newPassword"
            type={showPasswords ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
            }}
            required
            disabled={isLoading}
            autoComplete="new-password"
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => {
              setShowPasswords(!showPasswords);
            }}
            className={toggleClass}
            tabIndex={-1}
            aria-label={showPasswords ? i18n.chrome.hidePassword : i18n.chrome.showPassword}
          >
            {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
          {i18n.chrome.confirmNewPasswordLabel}
        </label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showPasswords ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
            }}
            required
            disabled={isLoading}
            autoComplete="new-password"
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => {
              setShowPasswords(!showPasswords);
            }}
            className={toggleClass}
            tabIndex={-1}
            aria-label={showPasswords ? i18n.chrome.hidePassword : i18n.chrome.showPassword}
          >
            {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
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
        {isLoading ? i18n.chrome.resetPasswordSaving : i18n.chrome.resetPasswordSubmit}
      </Button>
    </form>
  );
}
