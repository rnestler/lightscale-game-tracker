import React, { type JSX } from 'react';
import ReactDOM from 'react-dom/client';
import { initialLanguage, setLanguage, useLanguage } from './i18n/text';
import { App } from './App';
import { AuthProvider } from './hooks/useAuth';
import { PermissionsProvider } from './hooks/usePermissions';
import { Toaster } from './components/ui/toaster';
import { ActivityIndicator } from './components/ui/ActivityIndicator';
import { OfflineNotice } from './components/ui/OfflineNotice';

function Root(): JSX.Element {
  useLanguage();
  return (
    <React.StrictMode>
      <AuthProvider>
        <PermissionsProvider>
          <App />
          <Toaster />
          <ActivityIndicator />
          <OfflineNotice />
        </PermissionsProvider>
      </AuthProvider>
    </React.StrictMode>
  );
}

const oauthPopupParams = new URLSearchParams(window.location.search);
const isOAuthPopupCallback = oauthPopupParams.get('oauth_popup') === '1';

if (isOAuthPopupCallback) {
  const handoffParam = oauthPopupParams.get('handoff');
  const opener = window.opener as Window | null;
  if (opener && !opener.closed) {
    opener.postMessage({ type: 'oauth-complete', handoff: handoffParam }, window.location.origin);
  }
  window.close();
} else {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('The page has no root element');
  }
  const root = ReactDOM.createRoot(rootElement);
  setLanguage(initialLanguage())
    .then(() => {
      root.render(<Root />);
    })
    .catch((error: unknown) => {
      window.reportError(error);
    });
}
