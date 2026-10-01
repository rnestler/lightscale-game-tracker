import { i18n } from './i18n/text';
import type { JSX } from 'react';
import { Component, lazy, Suspense, useLayoutEffect, useSyncExternalStore } from 'react';
import { useAuth } from './hooks/useAuth';
import { usePermissions } from './hooks/usePermissions';
import { useClippedTitles } from './hooks/useClippedTitles';
import { adoptPath, isAuthRoute, replacePath, returnAfterSignIn } from './utils/recordNavigation';
import { AwaitingApproval } from './components/AwaitingApproval';

const RELOAD_GUARD_KEY = 'ls-route-reloaded';

function hasReloaded(): boolean {
  return window.sessionStorage.getItem(RELOAD_GUARD_KEY) !== null;
}

async function loadRoute<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (hasReloaded()) {
      throw error;
    }
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
    window.location.reload();
    return new Promise<T>(() => undefined);
  }
}

const Overview = lazy(() =>
  loadRoute(() => import('./components/Overview')).then((module) => ({ default: module.Overview }))
);
const AuthShell = lazy(() =>
  loadRoute(() => import('./components/AuthShell')).then((module) => ({
    default: module.AuthShell,
  }))
);
const GuestPrivacyInquiry = lazy(() =>
  loadRoute(() => import('./components/GuestPrivacyInquiry')).then((module) => ({
    default: module.GuestPrivacyInquiry,
  }))
);

type AppRoute =
  | '/'
  | '/login'
  | '/register'
  | '/forgot-password'
  | '/reset-password'
  | '/verify-email'
  | '/privacy'
  | '/app';

function normalizePath(pathname: string): AppRoute {
  const cleaned = pathname.replace(/\/+$/, '') || '/';
  if (
    cleaned === '/login' ||
    cleaned === '/register' ||
    cleaned === '/forgot-password' ||
    cleaned === '/reset-password' ||
    cleaned === '/verify-email' ||
    cleaned === '/app' ||
    cleaned === '/privacy'
  ) {
    return cleaned;
  }
  return '/app';
}

function subscribePath(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  return (): void => {
    window.removeEventListener('popstate', onChange);
  };
}

function currentRoute(): AppRoute {
  return normalizePath(window.location.pathname);
}

function usePathname(): AppRoute {
  return useSyncExternalStore(subscribePath, currentRoute);
}

function RouteFallback({ message }: { message: string }): JSX.Element {
  return (
    <div className="app-boot" role="status" aria-label={message}>
      <div className="app-boot-stage">
        <div className="app-boot-mark">
          <span className="app-boot-glow" />
          <img className="app-boot-logo" src="assets/leaderboard-logo.png" alt="" />
        </div>
        <p className="app-boot-title">{i18n.word("'GameRank Tracker'")}</p>
        <p className="app-boot-message">{message}</p>
        <span className="app-boot-track" />
      </div>
      <div className="app-boot-brand">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <path d="M 0 0 L 44 0 L 44 26 L 26 26 L 26 44 L 0 44 Z" fill="#00D9FF" />
          <path d="M 56 0 L 100 0 L 100 44 L 74 44 L 74 26 L 56 26 Z" fill="#00C4FF" />
          <path d="M 0 56 L 26 56 L 26 74 L 44 74 L 44 100 L 0 100 Z" fill="#0099FF" />
          <path d="M 74 56 L 100 56 L 100 100 L 56 100 L 56 74 L 74 74 Z" fill="#0077FF" />
        </svg>
        <span>Lightscale AI</span>
      </div>
    </div>
  );
}

function RouteRedirect({ to, message }: { to: string; message: string }): JSX.Element {
  useLayoutEffect(() => {
    replacePath(to);
  }, [to]);
  return <RouteFallback message={message} />;
}

function RequireAuth({ children }: { children: JSX.Element }): JSX.Element {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { isLoading: permissionsLoading, hasAppAccess } = usePermissions();

  if (authLoading || permissionsLoading) {
    return <RouteFallback message={i18n.chrome.loading} />;
  }

  if (!isAuthenticated) {
    return <RouteRedirect to="/login" message={i18n.chrome.redirecting} />;
  }

  if (!hasAppAccess) {
    return <AwaitingApproval />;
  }

  return children;
}

function AppRoutes(): JSX.Element {
  const visitedPath = usePathname();
  const { isAuthenticated, isLoading } = useAuth();
  const signedInReturn =
    (visitedPath === '/login' || visitedPath === '/register') && isAuthenticated
      ? returnAfterSignIn()
      : null;
  const pathname = signedInReturn === null ? visitedPath : normalizePath(adoptPath(signedInReturn));

  if (pathname === '/privacy') {
    return (
      <GuestPrivacyInquiry
        appTitle={i18n.word("'GameRank Tracker'")}
        logoUrl={'assets/leaderboard-logo.png'}
        backgroundUrl={'/assets/club-background.png'}
      />
    );
  }

  if (isAuthRoute(pathname)) {
    if (isLoading) {
      return <RouteFallback message={i18n.chrome.loading} />;
    }
    const mode =
      pathname === '/register'
        ? 'register'
        : pathname === '/forgot-password'
          ? 'forgot'
          : pathname === '/reset-password'
            ? 'reset'
            : pathname === '/verify-email'
              ? 'verify'
              : 'login';
    return <AuthShell mode={mode} />;
  }

  return (
    <RequireAuth>
      <Overview />
    </RequireAuth>
  );
}

class RouteBoundary extends Component<{ children: JSX.Element }, { failed: boolean }> {
  public constructor(props: { children: JSX.Element }) {
    super(props);
    this.state = { failed: false };
  }

  public static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  public render(): JSX.Element {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground">
        <div className="text-sm text-muted-foreground">{i18n.chrome.loadFailed}</div>
        <button
          type="button"
          className="rounded-[var(--radius-md)] border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          onClick={() => {
            window.sessionStorage.removeItem(RELOAD_GUARD_KEY);
            window.location.reload();
          }}
        >
          {i18n.chrome.reloadAction}
        </button>
      </div>
    );
  }
}

export function App(): JSX.Element {
  useClippedTitles();

  return (
    <RouteBoundary>
      <Suspense fallback={<RouteFallback message={i18n.chrome.loading} />}>
        <AppRoutes />
      </Suspense>
    </RouteBoundary>
  );
}
