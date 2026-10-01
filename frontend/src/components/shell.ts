import { i18n } from '../i18n/text';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { adoptRecordRoute, onShellNavigation, restrictShellViews } from '../utils/recordNavigation';

export const VALID_VIEWS: readonly string[] = [
  'leaderboards',
  'matches',
  'games',
  'players',
  'dashboard',
  'gameLeaderboards',
  'users',
  'access',
  'roles',
  'data-protection',
  'automation',
  'stale',
  'violations',
  'account-settings',
];
export const SHELL_VIEWS: Readonly<Record<string, string>> = {
  dashboard: 'dashboard',
  leaderboards: 'leaderboards',
  matches: 'matches',
  games: 'games',
  players: 'players',
  gameLeaderboards: 'gameLeaderboards',
};
export type ShellView =
  | 'leaderboards'
  | 'matches'
  | 'games'
  | 'players'
  | 'dashboard'
  | 'gameLeaderboards'
  | 'users'
  | 'access'
  | 'roles'
  | 'data-protection'
  | 'automation'
  | 'stale'
  | 'violations'
  | 'account-settings';

export interface Shell {
  readonly activeView: ShellView;
  readonly setActiveView: (view: ShellView) => void;
  readonly onNavigate: (view: string) => void;
  readonly homeView: ShellView;
  readonly accessibleViews: readonly string[];
  readonly viewNotAvailable: boolean;
  readonly scheme: string;
  readonly setScheme: (next: string) => void;
}

export function useShell(): Shell {
  useEffect(() => {
    document.title = i18n.word("'GameRank Tracker'");
  }, []);
  const { canAccess, isLoading: permissionsLoading, isAdmin } = usePermissions();
  const accessibleViews = useMemo(() => {
    const allViews: Array<Exclude<ShellView, null>> = [
      'matches',
      'leaderboards',
      'players',
      'games',
    ];
    return allViews.filter((view) => canAccess(view));
  }, [canAccess]);
  const reachableViews = useMemo(
    (): readonly string[] => ['dashboard', 'gameLeaderboards', ...accessibleViews],
    [accessibleViews]
  );
  const [requestedView, setActiveView] = useState<ShellView>(() => {
    const stored = sessionStorage.getItem('lightscale.activeView');
    return stored !== null && VALID_VIEWS.includes(stored) ? (stored as ShellView) : 'dashboard';
  });
  const activeView = ((): ShellView => {
    if (permissionsLoading) {
      return requestedView;
    }
    const isSpecialView =
      requestedView === 'account-settings' ||
      (isAdmin &&
        (requestedView === 'users' ||
          requestedView === 'access' ||
          requestedView === 'roles' ||
          requestedView === 'data-protection' ||
          requestedView === 'automation' ||
          requestedView === 'stale' ||
          requestedView === 'violations'));
    if (!reachableViews.includes(requestedView) && !isSpecialView && accessibleViews.length > 0) {
      return accessibleViews[0];
    }
    return requestedView;
  })();
  const viewNotAvailable = !permissionsLoading && activeView !== requestedView;
  useEffect(() => {
    sessionStorage.setItem('lightscale.activeView', activeView);
  }, [activeView]);
  useLayoutEffect(
    () =>
      onShellNavigation(SHELL_VIEWS, (view) => {
        setActiveView(view as ShellView);
      }),
    []
  );
  useLayoutEffect(() => restrictShellViews(reachableViews), [reachableViews]);
  useEffect(() => {
    if (!permissionsLoading) {
      adoptRecordRoute();
    }
  }, [permissionsLoading]);
  const homeView: ShellView = 'dashboard';
  const [scheme, setSchemeState] = useState<string>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );
  const setScheme = (next: string): void => {
    document.documentElement.classList.toggle('dark', next === 'dark');
    localStorage.setItem('lsai:theme', next);
    setSchemeState(next);
  };
  return {
    activeView,
    setActiveView,
    onNavigate: setActiveView as (view: string) => void,
    homeView,
    accessibleViews,
    viewNotAvailable,
    scheme,
    setScheme,
  };
}
