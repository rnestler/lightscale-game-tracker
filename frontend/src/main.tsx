import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { CurrencyGate } from './components/CurrencyGate';
import { AuthProvider } from './hooks/useAuth';
import { PermissionsProvider } from './hooks/usePermissions';
import { Toaster } from './components/ui/toaster';
import { ActivityIndicator } from './components/ui/ActivityIndicator';
import { OfflineNotice } from './components/ui/OfflineNotice';

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
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <AuthProvider>
          <PermissionsProvider>
            <CurrencyGate>
              <App />
            </CurrencyGate>
            <Toaster />
            <ActivityIndicator />
            <OfflineNotice />
          </PermissionsProvider>
        </AuthProvider>
      </React.StrictMode>
    );
  }
}
