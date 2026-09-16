import type { JSX } from 'react';
import { Component, lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { usePermissions } from './hooks/usePermissions';
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

function usePathname(): AppRoute {
  const [path, setPath] = useState<AppRoute>(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const onChange = (): void => {
      setPath(normalizePath(window.location.pathname));
    };
    window.addEventListener('popstate', onChange);
    return (): void => {
      window.removeEventListener('popstate', onChange);
    };
  }, []);

  return path;
}

function RouteFallback({ message }: { message: string }): JSX.Element {
  return (
    <div className="app-boot" role="status" aria-label={message}>
      <div className="app-boot-stage">
        <div className="app-boot-mark">
          <span className="app-boot-glow" />
          <img className="app-boot-logo" src="assets/leaderboard-logo.png" alt="" />
        </div>
        <p className="app-boot-title">{'GameRank Tracker'}</p>
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

function sameOriginReturn(returnTo: string | null): string {
  if (returnTo === null || !URL.canParse(returnTo, window.location.origin)) {
    return '/';
  }
  const target = new URL(returnTo, window.location.origin);
  const leavesOrigin = target.origin !== window.location.origin || target.pathname.startsWith('//');
  return leavesOrigin ? '/' : `${target.pathname}${target.search}${target.hash}`;
}

function RouteRedirect({ to, message }: { to: string; message: string }): JSX.Element {
  useEffect(() => {
    window.location.href = to;
  }, [to]);
  return <RouteFallback message={message} />;
}

function RequireAuth({ children }: { children: JSX.Element }): JSX.Element {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { isLoading: permissionsLoading, hasAppAccess } = usePermissions();

  if (authLoading || permissionsLoading) {
    return <RouteFallback message={'Loading…'} />;
  }

  if (!isAuthenticated) {
    return <RouteRedirect to="/login" message={'Redirecting…'} />;
  }

  if (!hasAppAccess) {
    return <AwaitingApproval />;
  }

  return children;
}

function AppRoutes(): JSX.Element {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();
  const isAuthRoute =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/verify-email';
  const redirectsWhenAuthenticated = pathname === '/login' || pathname === '/register';

  useEffect(() => {
    if (redirectsWhenAuthenticated && isAuthenticated) {
      window.location.href = sameOriginReturn(
        new URLSearchParams(window.location.search).get('returnTo')
      );
    }
  }, [redirectsWhenAuthenticated, isAuthenticated]);

  if (pathname === '/privacy') {
    return (
      <GuestPrivacyInquiry
        appTitle={'GameRank Tracker'}
        logoUrl={'assets/leaderboard-logo.png'}
        backgroundUrl={'/assets/club-background.png'}
      />
    );
  }

  if (isAuthRoute) {
    if (isLoading || (redirectsWhenAuthenticated && isAuthenticated)) {
      return <RouteFallback message={'Loading…'} />;
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
        <div className="text-sm text-muted-foreground">{'This page could not be loaded.'}</div>
        <button
          type="button"
          className="rounded-[var(--radius-md)] border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          onClick={() => {
            window.sessionStorage.removeItem(RELOAD_GUARD_KEY);
            window.location.reload();
          }}
        >
          {'Reload'}
        </button>
      </div>
    );
  }
}

export function App(): JSX.Element {
  return (
    <RouteBoundary>
      <Suspense fallback={<RouteFallback message={'Loading…'} />}>
        <AppRoutes />
      </Suspense>
    </RouteBoundary>
  );
}
