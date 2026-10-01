import { i18n } from '../../i18n/text';
import type { JSX } from 'react';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { authClient } from '../../api/authClient.js';
import { useSetupStatus } from '../../api/setupStatus.js';
import { getErrorMessage, isInvalidPasswordError } from '../../utils/errorHandling.js';

const MIN_PASSWORD_LENGTH = 10;

export function ChangePasswordSettings(): JSX.Element {
  const { changePassword, user } = useAuth();
  const setupStatus = useSetupStatus();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const resetFields = (): void => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSendResetLink = async (): Promise<void> => {
    if (user === null) {
      return;
    }
    setResetLoading(true);
    try {
      await authClient.requestPasswordReset({
        email: user.email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch (err) {
      console.error('Failed to request password reset', err);
    } finally {
      setResetSent(true);
      setResetLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

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
      await changePassword(currentPassword, newPassword);
      resetFields();
      setSuccess(i18n.chrome.passwordChangedSuccess);
    } catch (err) {
      setError(
        isInvalidPasswordError(err)
          ? i18n.chrome.currentPasswordIncorrect
          : getErrorMessage(err, i18n.chrome.passwordChangeFailed)
      );
      console.error('Failed to change password', err);
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'h-10 w-full rounded-md border border-border bg-background px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const toggleClass =
    'absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors text-sm';

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
          <h3 className="text-lg font-semibold text-foreground">
            {i18n.chrome.changePasswordTitle}
          </h3>
          <p className="text-sm text-muted-foreground">{i18n.chrome.changePasswordDescription}</p>
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

        <div className="flex flex-col gap-2">
          <label htmlFor="currentPassword" className="text-sm font-medium text-foreground">
            {i18n.chrome.currentPasswordLabel}
          </label>
          <div className="relative">
            <input
              id="currentPassword"
              type={showPasswords ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
              }}
              required
              disabled={isLoading}
              autoComplete="current-password"
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
          <label htmlFor="newPassword" className="text-sm font-medium text-foreground">
            {i18n.chrome.newPasswordLabel}
          </label>
          <div className="relative">
            <input
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
            <input
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

        <div className="flex">
          <button
            type="submit"
            disabled={isLoading}
            className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? i18n.chrome.changingPasswordIndicator : i18n.chrome.changePasswordButton}
          </button>
        </div>
      </form>

      {setupStatus.capabilities.passwordReset && (
        <div className="mt-8 border-t border-border pt-6 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-foreground">
              {i18n.chrome.resetViaEmailTitle}
            </h3>
            <p className="text-sm text-muted-foreground">{i18n.chrome.resetViaEmailDescription}</p>
          </div>
          {resetSent ? (
            <div className="rounded-md border border-border bg-secondary p-3 text-sm text-foreground">
              {i18n.chrome.resetViaEmailSent}
            </div>
          ) : (
            <div className="flex">
              <button
                type="button"
                disabled={resetLoading}
                onClick={() => {
                  handleSendResetLink().catch((err) => {
                    console.error('Failed to send reset link', err);
                  });
                }}
                className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetLoading ? i18n.chrome.forgotPasswordSending : i18n.chrome.resetViaEmailButton}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
