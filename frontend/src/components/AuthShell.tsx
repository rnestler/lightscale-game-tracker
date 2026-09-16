import type { JSX } from 'react';
import { AuthFrame } from './AuthFrame';
import { Login } from './auth/Login';
import { Register } from './auth/Register';
import { ForgotPassword } from './auth/ForgotPassword';
import { ResetPassword } from './auth/ResetPassword';
import { VerifyEmail } from './auth/VerifyEmail';

export function AuthShell({
  mode,
}: {
  mode: 'login' | 'register' | 'forgot' | 'reset' | 'verify';
}): JSX.Element {
  const title =
    mode === 'login'
      ? 'Sign in'
      : mode === 'register'
        ? 'Create account'
        : mode === 'forgot'
          ? 'Reset password'
          : mode === 'verify'
            ? 'Verify your email'
            : 'Set a new password';
  const subtitle =
    mode === 'forgot'
      ? 'Enter your account email and we will send you a link to reset your password.'
      : mode === 'reset'
        ? 'Choose a new password for your account.'
        : mode === 'verify'
          ? 'Confirming your email address.'
          : null;

  return (
    <AuthFrame title={title} subtitle={subtitle}>
      {mode === 'login' ? (
        <Login
          onSwitchToRegister={() => {
            window.location.href = '/register';
          }}
        />
      ) : mode === 'register' ? (
        <Register
          onSwitchToLogin={() => {
            window.location.href = '/login';
          }}
        />
      ) : mode === 'forgot' ? (
        <ForgotPassword />
      ) : mode === 'verify' ? (
        <VerifyEmail />
      ) : (
        <ResetPassword />
      )}
    </AuthFrame>
  );
}
