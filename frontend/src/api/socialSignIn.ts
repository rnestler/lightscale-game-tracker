import { authClient } from './authClient.js';
import { apiBaseUrl } from '../config/apiConfig.js';
import { returnAfterSignIn } from '../utils/recordNavigation.js';

type SocialProvider = 'google' | 'microsoft';

const POPUP_WIDTH = 500;
const POPUP_HEIGHT = 600;
const FALLBACK_POLL_INTERVAL_MS = 300;

function establishSessionFromHandoff(handoff: string): Promise<void> {
  return fetch(`${apiBaseUrl}/api/auth/set-session?handoff=${encodeURIComponent(handoff)}`, {
    method: 'GET',
    credentials: 'include',
  }).then(() => undefined);
}

function refreshSessionAndReload(): void {
  authClient
    .getSession()
    .then((sessionResult) => {
      if (sessionResult.data?.session) {
        window.location.reload();
      }
    })
    .catch((err) => {
      console.error('Failed to refresh session after OAuth', err);
    });
}

function openCenteredPopup(url: string): Window | null {
  const left = Math.round(window.screenX + (window.outerWidth - POPUP_WIDTH) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2);
  return window.open(
    url,
    'oauth_popup',
    `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},popup=1`
  );
}

function watchPopup(popup: Window): void {
  let settled = false;
  let fallbackPoll: ReturnType<typeof setInterval> | null = null;
  let messageHandler:
    ((event: MessageEvent<{ type?: string; handoff?: string | null }>) => void) | null = null;

  const cleanup = (): void => {
    if (messageHandler !== null) {
      window.removeEventListener('message', messageHandler);
    }
    if (fallbackPoll !== null) {
      clearInterval(fallbackPoll);
    }
    if (!popup.closed) {
      popup.close();
    }
  };

  const finishWithHandoff = (handoff: string): void => {
    if (settled) {
      return;
    }
    settled = true;
    cleanup();
    establishSessionFromHandoff(handoff)
      .then(refreshSessionAndReload)
      .catch((err) => {
        console.error('Failed to establish session from OAuth handoff', err);
        refreshSessionAndReload();
      });
  };

  const finishWithoutHandoff = (): void => {
    if (settled) {
      return;
    }
    settled = true;
    cleanup();
    refreshSessionAndReload();
  };

  messageHandler = (event): void => {
    if (event.source !== popup) {
      return;
    }
    if (event.origin !== window.location.origin) {
      return;
    }
    if (event.data.type === 'oauth-complete') {
      const { handoff } = event.data;
      if (typeof handoff === 'string' && handoff !== '') {
        finishWithHandoff(handoff);
      } else {
        finishWithoutHandoff();
      }
    }
  };

  window.addEventListener('message', messageHandler);

  fallbackPoll = setInterval(() => {
    if (popup.closed) {
      finishWithoutHandoff();
    }
  }, FALLBACK_POLL_INTERVAL_MS);
}

export function startSocialSignIn(provider: SocialProvider): void {
  const callbackURL = `${window.location.origin}${returnAfterSignIn()}`;
  const isInIframe = window !== window.top;

  if (!isInIframe) {
    authClient.signIn.social({ provider, callbackURL }).catch((err) => {
      console.error('Social sign-in error', err);
    });
    return;
  }

  const popupCallbackURL = new URL(callbackURL);
  popupCallbackURL.searchParams.set('oauth_popup', '1');
  authClient.signIn
    .social({ provider, callbackURL: popupCallbackURL.toString(), disableRedirect: true })
    .then((result) => {
      const oauthUrl = result.data?.url;
      if (!oauthUrl) {
        return;
      }
      const popup = openCenteredPopup(oauthUrl);
      if (popup === null) {
        return;
      }
      watchPopup(popup);
    })
    .catch((err) => {
      console.error('Social sign-in error', err);
    });
}
