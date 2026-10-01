import { i18n } from '../../i18n/text';
import type { JSX } from 'react';
import { useState } from 'react';
import { authClient } from '../../api/authClient.js';
import { openSignIn } from '../../utils/recordNavigation.js';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export function ForgotPassword(): JSX.Element {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsLoading(true);
    try {
      await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch (err) {
      console.error('Failed to request password reset', err);
    } finally {
      setSent(true);
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-lg border border-border bg-secondary p-3 text-sm text-foreground">
          {i18n.chrome.forgotPasswordSent}
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            openSignIn();
          }}
          className="text-foreground hover:opacity-80 focus-visible:outline-primary"
        >
          {i18n.chrome.backToSignIn}
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
        <label htmlFor="email" className="text-sm font-medium text-foreground">
          {i18n.chrome.emailLabel}
        </label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
          }}
          required
          disabled={isLoading}
          autoComplete="email"
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        className="bg-primary text-primary-foreground hover:opacity-90 focus-visible:outline-primary"
        size="lg"
      >
        {isLoading ? i18n.chrome.forgotPasswordSending : i18n.chrome.forgotPasswordSubmit}
      </Button>

      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          openSignIn();
        }}
        disabled={isLoading}
        className="text-foreground hover:opacity-80 focus-visible:outline-primary"
      >
        {i18n.chrome.backToSignIn}
      </Button>
    </form>
  );
}
