import { i18n } from '../i18n/text';
import type { JSX } from 'react';
import { AuthFrame } from './AuthFrame';
import { Login } from './auth/Login';
import { Register } from './auth/Register';
import { ForgotPassword } from './auth/ForgotPassword';
import { ResetPassword } from './auth/ResetPassword';
import { VerifyEmail } from './auth/VerifyEmail';
import { navigateToPath, openSignIn } from '../utils/recordNavigation';

export function AuthShell({
  mode,
}: {
  mode: 'login' | 'register' | 'forgot' | 'reset' | 'verify';
}): JSX.Element {
  const title =
    mode === 'login'
      ? i18n.chrome.signIn
      : mode === 'register'
        ? i18n.chrome.createAccount
        : mode === 'forgot'
          ? i18n.chrome.forgotPasswordTitle
          : mode === 'verify'
            ? i18n.chrome.verifyEmailTitle
            : i18n.chrome.resetPasswordTitle;
  const subtitle =
    mode === 'forgot'
      ? i18n.chrome.forgotPasswordSubtitle
      : mode === 'reset'
        ? i18n.chrome.resetPasswordSubtitle
        : mode === 'verify'
          ? i18n.chrome.verifyEmailSubtitle
          : '';

  return (
    <AuthFrame screenTitle={title} screenSubtitle={subtitle}>
      {mode === 'login' ? (
        <Login
          onSwitchToRegister={() => {
            navigateToPath('/register');
          }}
        />
      ) : mode === 'register' ? (
        <Register
          onSwitchToLogin={() => {
            openSignIn();
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
