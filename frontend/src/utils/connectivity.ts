import { apiBaseUrl } from '../config/apiConfig';
import { fireAndForget } from './errorHandling';

export type ConnectivityState = 'online' | 'offline' | 'restored';

type ConnectivityListener = (state: ConnectivityState) => void;

const PROBE_INTERVAL_MS = 4000;
const RESTORED_DISPLAY_MS = 2600;

const listeners = new Set<ConnectivityListener>();
let state: ConnectivityState = 'online';
let probeTimer: ReturnType<typeof setInterval> | null = null;
let restoredTimer: ReturnType<typeof setTimeout> | null = null;

function notify(): void {
  for (const listener of listeners) {
    listener(state);
  }
}

function stopProbing(): void {
  if (probeTimer !== null) {
    clearInterval(probeTimer);
    probeTimer = null;
  }
}

function clearRestoredTimer(): void {
  if (restoredTimer !== null) {
    clearTimeout(restoredTimer);
    restoredTimer = null;
  }
}

export function reportReachable(): void {
  if (state !== 'offline') {
    return;
  }
  stopProbing();
  state = 'restored';
  notify();
  restoredTimer = setTimeout(() => {
    restoredTimer = null;
    state = 'online';
    notify();
  }, RESTORED_DISPLAY_MS);
}

function pingServer(): Promise<boolean> {
  return fetch(`${apiBaseUrl}/health`, { cache: 'no-store' }).then(
    (response) => response.ok,
    () => false
  );
}

function reportUnreachable(): void {
  clearRestoredTimer();
  probeTimer ??= setInterval(() => {
    fireAndForget(
      pingServer().then((reachable) => {
        if (reachable) {
          reportReachable();
        }
      })
    );
  }, PROBE_INTERVAL_MS);
  if (state !== 'offline') {
    state = 'offline';
    notify();
  }
}

export async function checkReachable(): Promise<boolean> {
  const reachable = await pingServer();
  if (reachable) {
    reportReachable();
  } else {
    reportUnreachable();
  }
  return reachable;
}

export function reportRequestFailure(): void {
  fireAndForget(checkReachable());
}

export function subscribeConnectivity(listener: ConnectivityListener): () => void {
  listeners.add(listener);
  listener(state);
  return (): void => {
    listeners.delete(listener);
  };
}

window.addEventListener('offline', reportUnreachable);
window.addEventListener('online', () => {
  fireAndForget(checkReachable());
});

if (!window.navigator.onLine) {
  reportUnreachable();
}
