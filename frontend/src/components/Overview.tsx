import type { JSX } from 'react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { onShellNavigation } from '../utils/recordNavigation';
import { usePermissions } from '../hooks/usePermissions';
import { apiBaseUrl } from '../config/apiConfig';
import { runWithToast } from '../utils/errorHandling';
import { Button } from './ui/button';
import { Avatar } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import {
  ArchiveIcon,
  DicesIcon,
  FolderIcon,
  KeyRoundIcon,
  LockIcon,
  LogOutIcon,
  MenuIcon,
  MoonIcon,
  PanelLeftCloseIcon,
  PanelLeftIcon,
  SettingsIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SunIcon,
  SwordsIcon,
  Trash2Icon,
  TrophyIcon,
  UserIcon,
  UsersIcon,
  WorkflowIcon,
  XIcon,
} from 'lucide-react';
import { ChangePasswordSettings } from './auth/ChangePasswordSettings';
import { PasskeySettings } from './auth/PasskeySettings';
import { TwoFactorSettings } from './auth/TwoFactorSettings';
import { DeleteAccountSettings } from './auth/DeleteAccountSettings';
import { PrivacySettings } from './auth/PrivacySettings';
import { DashboardPanel } from './DashboardPanel';
import { LeaderboardsList } from './LeaderboardsList';
import { MatchesList } from './MatchesList';
import { GamesList } from './GamesList';
import { PlayersList } from './PlayersList';
import { GameLeaderboardsSpotlight } from '../spotlights/GameLeaderboardsSpotlight';
import { UserManagement } from './UserManagement';
import { AccessSettings } from './AccessSettings';
import { RolePermissions } from './RolePermissions';
import { DataProtectionDashboard } from './DataProtectionDashboard';
import { AutomationManagement } from './AutomationManagement';
import { StaleDataView } from './StaleDataPanel';
import { RuleViolationsView } from './RuleViolationsPanel';

const VALID_VIEWS: readonly string[] = [
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
const SHELL_VIEWS: Readonly<Record<string, string>> = {
  leaderboards: 'leaderboards',
  matches: 'matches',
  games: 'games',
  players: 'players',
};
const VIEW_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  leaderboards: 'Leaderboards',
  matches: 'Matches',
  games: 'Games',
  players: 'Players',
  gameLeaderboards: 'Leaderboards by Game',
  users: 'Users',
  access: 'Access',
  roles: 'Roles',
  'data-protection': 'Data Protection',
  automation: 'Automations',
  stale: 'Stale data',
  violations: 'Rule violations',
  'account-settings': 'Settings',
};

export function Overview(): JSX.Element {
  const { user, signOut } = useAuth();
  useEffect(() => {
    document.title = 'GameRank Tracker';
  }, []);
  const {
    permissions,
    canAccess,
    isLoading: permissionsLoading,
    isAdmin,
    allowAccountDeletion,
  } = usePermissions();
  const canDeleteAccount = allowAccountDeletion && !isAdmin;
  const [userRoles, setUserRoles] = useState<string[]>([]);

  const accessibleViews = useMemo(() => {
    const allViews: Array<'leaderboards' | 'matches' | 'games' | 'players'> = [
      'matches',
      'leaderboards',
      'players',
      'games',
    ];
    return allViews.filter((view) => canAccess(view));
  }, [canAccess]);

  const isUserAdmin = userRoles.includes('admin');
  const accountName = user?.name ?? user?.email ?? '';
  const accountEmail = user?.email ?? '';
  const ROLE_LABELS: Record<string, string | undefined> = {
    guest: 'Guest',
    unassigned: 'Unassigned',
    admin: 'Admin',
    player: 'Player',
    scorekeeper: 'Scorekeeper',
  };
  const accountRoles = userRoles.map((role) => ROLE_LABELS[role] ?? role).join(', ');
  const accountTitle = userRoles.length > 0 ? `${accountName} — ${accountRoles}` : accountName;

  const [requestedView, setActiveView] = useState<
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
    | 'account-settings'
  >(() => {
    const stored = sessionStorage.getItem('lightscale.activeView');
    return stored !== null && VALID_VIEWS.includes(stored)
      ? (stored as
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
          | 'account-settings')
      : 'dashboard';
  });
  const [activeSettingsTab, setActiveSettingsTab] = useState<
    'password' | 'passkeys' | '2fa' | 'privacy' | 'account'
  >('password');
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('lightscale.sidebarCollapsed') === 'true';
    } catch {
      return false;
    }
  });
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(64);

  const activeView = ((): typeof requestedView => {
    if (permissionsLoading) {
      return requestedView;
    }
    const pageKeys: string[] = ['dashboard', 'gameLeaderboards'];
    const isPageView = pageKeys.includes(requestedView);
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
    const isVariableViewAccessible = accessibleViews.some((view) => view === requestedView);
    if (!isPageView && !isSpecialView && !isVariableViewAccessible && accessibleViews.length > 0) {
      return accessibleViews[0];
    }
    return requestedView;
  })();

  const activeLabel = VIEW_LABELS[activeView];

  useEffect(() => {
    sessionStorage.setItem('lightscale.activeView', activeView);
  }, [activeView]);

  useEffect(
    () =>
      onShellNavigation(SHELL_VIEWS, (view) => {
        setActiveView(
          view as
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
            | 'account-settings'
        );
      }),
    []
  );

  const onNavigate = setActiveView as (view: string) => void;

  useEffect(() => {
    const updateHeight = (): void => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.offsetHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return (): void => {
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetch(`${apiBaseUrl}/api/user/roles`, {
        credentials: 'include',
      })
        .then((response) => response.json())
        .then((data: { roles: string[] }) => {
          setUserRoles(data.roles);
        })
        .catch((error) => {
          console.error('Failed to fetch user roles:', error);
        });
    }
  }, [user]);

  return (
    <div
      className={`ui-app-shell isolate min-h-screen print:min-h-0 bg-background print:bg-transparent text-foreground ui-shell-glass${sidebarCollapsed ? ' ui-shell-collapsed' : ''}`}
    >
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          backgroundImage: "url('/assets/club-background.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 -z-10 bg-white/40 dark:bg-black/40 pointer-events-none"
        aria-hidden="true"
      />
      <aside className="ui-sidebar-rail hidden md:flex md:flex-col fixed inset-y-0 left-0 z-40 md:w-[var(--app-sidebar-w)] border-r border-shell-foreground/15 bg-shell text-shell-foreground md:transition-[width] md:duration-200 md:ease-in-out print:hidden">
        <div className="ui-sidebar-head h-16 flex items-center justify-between gap-2 px-4 border-b border-shell-foreground/10">
          <div className="ui-sidebar-brand min-w-0 flex-1">
            <a href="/" className="min-w-0 flex items-center gap-3 cursor-pointer">
              <img
                src="assets/leaderboard-logo.png"
                alt=""
                className="h-7 w-7 object-contain flex-shrink-0"
              />
              <span className="truncate text-base font-bold tracking-tight text-shell-foreground hover:opacity-80 transition-opacity">
                GameRank Tracker
              </span>
            </a>
          </div>
          <button
            type="button"
            aria-label="Toggle sidebar"
            aria-pressed={sidebarCollapsed}
            data-ls="97f4e9a883"
            className="h-8 w-8 flex flex-shrink-0 items-center justify-center rounded-md hover:bg-shell-foreground/10 transition-colors text-shell-foreground"
            onClick={() => {
              const next = !sidebarCollapsed;
              setSidebarCollapsed(next);
              try {
                localStorage.setItem('lightscale.sidebarCollapsed', String(next));
              } catch {
                /* Empty by design */
              }
            }}
          >
            {sidebarCollapsed ? (
              <PanelLeftIcon className="h-5 w-5" />
            ) : (
              <PanelLeftCloseIcon className="h-5 w-5" />
            )}
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-2">
          <div className="flex flex-col gap-1 p-2 w-full">
            <div className="flex flex-col gap-1 w-full">
              <button
                type="button"
                className="flex flex-row items-center gap-3 p-2 rounded-md w-full overflow-hidden text-sm font-medium text-shell-foreground/70 hover:bg-shell-foreground/10 hover:text-shell-foreground aria-selected:bg-shell-foreground/10 aria-selected:text-shell-foreground aria-selected:font-semibold"
                data-ls="d005b5c9b0"
                aria-selected={activeView === 'dashboard'}
                onClick={() => {
                  setActiveView('dashboard');
                }}
              >
                <FolderIcon className="shrink-0 h-4 w-4" />
                <span className="break-words truncate">{'Dashboard'}</span>
              </button>
              {(permissions?.['leaderboards']?.read ?? false) ||
              (permissions?.['leaderboards']?.create ?? false) ? (
                <button
                  type="button"
                  className="flex flex-row items-center gap-3 p-2 rounded-md w-full overflow-hidden text-sm font-medium text-shell-foreground/70 hover:bg-shell-foreground/10 hover:text-shell-foreground aria-selected:bg-shell-foreground/10 aria-selected:text-shell-foreground aria-selected:font-semibold"
                  data-ls="187c1c9a55"
                  aria-selected={activeView === 'leaderboards'}
                  onClick={() => {
                    setActiveView('leaderboards');
                  }}
                >
                  <TrophyIcon className="shrink-0 h-4 w-4" />
                  <span className="break-words truncate">{'Leaderboards'}</span>
                </button>
              ) : null}
              {(permissions?.['matches']?.read ?? false) ||
              (permissions?.['matches']?.create ?? false) ? (
                <button
                  type="button"
                  className="flex flex-row items-center gap-3 p-2 rounded-md w-full overflow-hidden text-sm font-medium text-shell-foreground/70 hover:bg-shell-foreground/10 hover:text-shell-foreground aria-selected:bg-shell-foreground/10 aria-selected:text-shell-foreground aria-selected:font-semibold"
                  data-ls="0ff0d92f24"
                  aria-selected={activeView === 'matches'}
                  onClick={() => {
                    setActiveView('matches');
                  }}
                >
                  <SwordsIcon className="shrink-0 h-4 w-4" />
                  <span className="break-words truncate">{'Matches'}</span>
                </button>
              ) : null}
              {(permissions?.['games']?.read ?? false) ||
              (permissions?.['games']?.create ?? false) ? (
                <button
                  type="button"
                  className="flex flex-row items-center gap-3 p-2 rounded-md w-full overflow-hidden text-sm font-medium text-shell-foreground/70 hover:bg-shell-foreground/10 hover:text-shell-foreground aria-selected:bg-shell-foreground/10 aria-selected:text-shell-foreground aria-selected:font-semibold"
                  data-ls="137f2da463"
                  aria-selected={activeView === 'games'}
                  onClick={() => {
                    setActiveView('games');
                  }}
                >
                  <DicesIcon className="shrink-0 h-4 w-4" />
                  <span className="break-words truncate">{'Games'}</span>
                </button>
              ) : null}
              {(permissions?.['players']?.read ?? false) ||
              (permissions?.['players']?.create ?? false) ? (
                <button
                  type="button"
                  className="flex flex-row items-center gap-3 p-2 rounded-md w-full overflow-hidden text-sm font-medium text-shell-foreground/70 hover:bg-shell-foreground/10 hover:text-shell-foreground aria-selected:bg-shell-foreground/10 aria-selected:text-shell-foreground aria-selected:font-semibold"
                  data-ls="b487c04fca"
                  aria-selected={activeView === 'players'}
                  onClick={() => {
                    setActiveView('players');
                  }}
                >
                  <UserIcon className="shrink-0 h-4 w-4" />
                  <span className="break-words truncate">{'Players'}</span>
                </button>
              ) : null}
              <button
                type="button"
                className="flex flex-row items-center gap-3 p-2 rounded-md w-full overflow-hidden text-sm font-medium text-shell-foreground/70 hover:bg-shell-foreground/10 hover:text-shell-foreground aria-selected:bg-shell-foreground/10 aria-selected:text-shell-foreground aria-selected:font-semibold"
                data-ls="3f8d4d9916"
                aria-selected={activeView === 'gameLeaderboards'}
                onClick={() => {
                  setActiveView('gameLeaderboards');
                }}
              >
                <SparklesIcon className="shrink-0 h-4 w-4" />
                <span className="break-words truncate">{'Leaderboards by Game'}</span>
              </button>
            </div>
          </div>
          {userRoles.includes('admin') ? (
            <div className="flex flex-col gap-1 p-2 w-full" data-ls="f10d5a605a">
              <span className="break-words text-xs font-medium uppercase tracking-wide px-2 text-shell-foreground/50">
                {'Admin'}
              </span>
              <div className="flex flex-col gap-1 w-full">
                <button
                  type="button"
                  className="flex flex-row items-center gap-3 p-2 rounded-md w-full overflow-hidden text-sm font-medium text-shell-foreground/70 hover:bg-shell-foreground/10 hover:text-shell-foreground aria-selected:bg-shell-foreground/10 aria-selected:text-shell-foreground aria-selected:font-semibold"
                  data-ls="ce11e2cab5"
                  aria-selected={activeView === 'users'}
                  onClick={() => {
                    setActiveView('users');
                  }}
                >
                  <UsersIcon className="shrink-0 h-4 w-4" />
                  <span className="break-words truncate">{'Users'}</span>
                </button>
                <button
                  type="button"
                  className="flex flex-row items-center gap-3 p-2 rounded-md w-full overflow-hidden text-sm font-medium text-shell-foreground/70 hover:bg-shell-foreground/10 hover:text-shell-foreground aria-selected:bg-shell-foreground/10 aria-selected:text-shell-foreground aria-selected:font-semibold"
                  data-ls="a48ae0c7d7"
                  aria-selected={activeView === 'access'}
                  onClick={() => {
                    setActiveView('access');
                  }}
                >
                  <ShieldCheckIcon className="shrink-0 h-4 w-4" />
                  <span className="break-words truncate">{'Access'}</span>
                </button>
                <button
                  type="button"
                  className="flex flex-row items-center gap-3 p-2 rounded-md w-full overflow-hidden text-sm font-medium text-shell-foreground/70 hover:bg-shell-foreground/10 hover:text-shell-foreground aria-selected:bg-shell-foreground/10 aria-selected:text-shell-foreground aria-selected:font-semibold"
                  data-ls="a3c02a1dbd"
                  aria-selected={activeView === 'roles'}
                  onClick={() => {
                    setActiveView('roles');
                  }}
                >
                  <LockIcon className="shrink-0 h-4 w-4" />
                  <span className="break-words truncate">{'Roles'}</span>
                </button>
                <button
                  type="button"
                  className="flex flex-row items-center gap-3 p-2 rounded-md w-full overflow-hidden text-sm font-medium text-shell-foreground/70 hover:bg-shell-foreground/10 hover:text-shell-foreground aria-selected:bg-shell-foreground/10 aria-selected:text-shell-foreground aria-selected:font-semibold"
                  data-ls="142fa11834"
                  aria-selected={activeView === 'data-protection'}
                  onClick={() => {
                    setActiveView('data-protection');
                  }}
                >
                  <ShieldCheckIcon className="shrink-0 h-4 w-4" />
                  <span className="break-words truncate">{'Data Protection'}</span>
                </button>
                <button
                  type="button"
                  className="flex flex-row items-center gap-3 p-2 rounded-md w-full overflow-hidden text-sm font-medium text-shell-foreground/70 hover:bg-shell-foreground/10 hover:text-shell-foreground aria-selected:bg-shell-foreground/10 aria-selected:text-shell-foreground aria-selected:font-semibold"
                  data-ls="6ee8b28d7d"
                  aria-selected={activeView === 'automation'}
                  onClick={() => {
                    setActiveView('automation');
                  }}
                >
                  <WorkflowIcon className="shrink-0 h-4 w-4" />
                  <span className="break-words truncate">{'Automations'}</span>
                </button>
                <button
                  type="button"
                  className="flex flex-row items-center gap-3 p-2 rounded-md w-full overflow-hidden text-sm font-medium text-shell-foreground/70 hover:bg-shell-foreground/10 hover:text-shell-foreground aria-selected:bg-shell-foreground/10 aria-selected:text-shell-foreground aria-selected:font-semibold"
                  data-ls="167db068d0"
                  aria-selected={activeView === 'stale'}
                  onClick={() => {
                    setActiveView('stale');
                  }}
                >
                  <ArchiveIcon className="shrink-0 h-4 w-4" />
                  <span className="break-words truncate">{'Stale data'}</span>
                </button>
                <button
                  type="button"
                  className="flex flex-row items-center gap-3 p-2 rounded-md w-full overflow-hidden text-sm font-medium text-shell-foreground/70 hover:bg-shell-foreground/10 hover:text-shell-foreground aria-selected:bg-shell-foreground/10 aria-selected:text-shell-foreground aria-selected:font-semibold"
                  data-ls="f81858e94b"
                  aria-selected={activeView === 'violations'}
                  onClick={() => {
                    setActiveView('violations');
                  }}
                >
                  <ShieldAlertIcon className="shrink-0 h-4 w-4" />
                  <span className="break-words truncate">{'Rule violations'}</span>
                </button>
              </div>
            </div>
          ) : null}
        </nav>
      </aside>

      <header
        ref={headerRef}
        className="ui-topbar fixed inset-x-0 top-0 z-50 md:left-[var(--app-sidebar-w)] md:transition-[left] md:duration-200 md:ease-in-out bg-shell text-shell-foreground border-b border-shell-foreground/15 print:hidden"
      >
        <div className="h-16 flex items-center justify-between gap-1 px-4 sm:gap-2 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              className="md:hidden h-8 w-8 flex flex-shrink-0 items-center justify-center rounded-md hover:bg-shell-foreground/10 transition-colors text-shell-foreground"
              onClick={() => {
                setIsMobileMenuOpen(!isMobileMenuOpen);
              }}
            >
              {isMobileMenuOpen ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
            <h1 className="text-base font-semibold tracking-tight whitespace-normal [overflow-wrap:anywhere] min-w-0">
              {activeLabel}
            </h1>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 flex-shrink-0">
            <button
              type="button"
              aria-label="Toggle theme"
              className="h-9 w-9 p-0 flex-shrink-0 flex items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={() => {
                const isDarkMode = document.documentElement.classList.toggle('dark');
                localStorage.setItem('lsai:theme', isDarkMode ? 'dark' : 'light');
                setIsDark(isDarkMode);
              }}
            >
              {isDark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
            </button>
            {isUserAdmin && (
              <div className="md:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 w-9 p-0 rounded-md flex-shrink-0"
                      aria-label="Admin"
                      data-ls="48b4cfbe9f"
                    >
                      <ShieldCheckIcon className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-56 rounded-lg shadow-lg"
                    data-ls="9e723588d2"
                  >
                    <DropdownMenuLabel>Admin</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="px-4 py-2.5 focus:bg-accent focus:text-accent-foreground"
                      onSelect={() => {
                        setActiveView('users');
                      }}
                      data-ls="ce11e2cab5"
                    >
                      <UsersIcon className="h-4 w-4" />
                      <span>Users</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="px-4 py-2.5 focus:bg-accent focus:text-accent-foreground"
                      onSelect={() => {
                        setActiveView('access');
                      }}
                      data-ls="a48ae0c7d7"
                    >
                      <ShieldCheckIcon className="h-4 w-4" />
                      <span>Access</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="px-4 py-2.5 focus:bg-accent focus:text-accent-foreground"
                      onSelect={() => {
                        setActiveView('roles');
                      }}
                      data-ls="a3c02a1dbd"
                    >
                      <LockIcon className="h-4 w-4" />
                      <span>Roles</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="px-4 py-2.5 focus:bg-accent focus:text-accent-foreground"
                      onSelect={() => {
                        setActiveView('data-protection');
                      }}
                      data-ls="142fa11834"
                    >
                      <ShieldCheckIcon className="h-4 w-4" />
                      <span>Data Protection</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="px-4 py-2.5 focus:bg-accent focus:text-accent-foreground"
                      onSelect={() => {
                        setActiveView('automation');
                      }}
                      data-ls="6ee8b28d7d"
                    >
                      <WorkflowIcon className="h-4 w-4" />
                      <span>Automations</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="px-4 py-2.5 focus:bg-accent focus:text-accent-foreground"
                      onSelect={() => {
                        setActiveView('stale');
                      }}
                      data-ls="167db068d0"
                    >
                      <ArchiveIcon className="h-4 w-4" />
                      <span>Stale data</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="px-4 py-2.5 focus:bg-accent focus:text-accent-foreground"
                      onSelect={() => {
                        setActiveView('violations');
                      }}
                      data-ls="f81858e94b"
                    >
                      <ShieldAlertIcon className="h-4 w-4" />
                      <span>Rule violations</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-full flex-shrink-0 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={accountTitle}
                  data-ls="7fb17f4feb"
                >
                  <Avatar name={accountName} image={user?.image ?? null} size="control" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-lg shadow-lg">
                <DropdownMenuLabel>
                  <p className="text-sm font-semibold text-foreground break-words">{accountName}</p>
                  {accountEmail !== accountName && (
                    <p className="text-xs font-normal text-muted-foreground break-all">
                      {accountEmail}
                    </p>
                  )}
                  {userRoles.length > 0 && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <ShieldCheckIcon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{accountRoles}</span>
                    </p>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="px-4 py-2.5 focus:bg-accent focus:text-accent-foreground"
                  onSelect={() => {
                    setActiveView('account-settings');
                  }}
                  data-ls="2e88d9ed3f"
                >
                  <SettingsIcon className="h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="px-4 py-2.5 focus:bg-accent focus:text-accent-foreground"
                  onSelect={() => {
                    runWithToast(
                      (async (): Promise<void> => {
                        await signOut();
                        window.location.href = '/';
                      })()
                    );
                  }}
                >
                  <LogOutIcon className="h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {isMobileMenuOpen && (
        <>
          <div
            className="ui-overlay-backdrop-soft fixed inset-0 z-40 md:hidden print:hidden"
            onClick={() => {
              setIsMobileMenuOpen(false);
            }}
          />
          <div
            className="ui-sidebar fixed left-0 z-50 w-[260px] overflow-y-auto border-r border-shell-foreground/15 bg-shell text-shell-foreground md:hidden print:hidden"
            style={{ top: `${headerHeight}px`, height: `calc(100vh - ${headerHeight}px)` }}
          >
            <div className="flex items-center px-4 py-3 border-b border-shell-foreground/15">
              <a href="/" className="min-w-0 flex items-center gap-3 cursor-pointer">
                <img
                  src="assets/leaderboard-logo.png"
                  alt=""
                  className="h-7 w-7 object-contain flex-shrink-0"
                />
                <span className="truncate text-base font-bold tracking-tight text-shell-foreground hover:opacity-80 transition-opacity">
                  GameRank Tracker
                </span>
              </a>
            </div>
            <nav
              className="flex flex-col gap-1 px-3 py-4"
              onClick={() => {
                setIsMobileMenuOpen(false);
              }}
            >
              <button
                type="button"
                className="flex flex-row items-center gap-3 p-2 rounded-md w-full overflow-hidden text-sm font-medium text-shell-foreground/70 hover:bg-shell-foreground/10 hover:text-shell-foreground aria-selected:bg-shell-foreground/10 aria-selected:text-shell-foreground aria-selected:font-semibold"
                data-ls="d005b5c9b0"
                aria-selected={activeView === 'dashboard'}
                onClick={() => {
                  setActiveView('dashboard');
                }}
              >
                <FolderIcon className="shrink-0 h-4 w-4" />
                <span className="break-words truncate">{'Dashboard'}</span>
              </button>
              {(permissions?.['leaderboards']?.read ?? false) ||
              (permissions?.['leaderboards']?.create ?? false) ? (
                <button
                  type="button"
                  className="flex flex-row items-center gap-3 p-2 rounded-md w-full overflow-hidden text-sm font-medium text-shell-foreground/70 hover:bg-shell-foreground/10 hover:text-shell-foreground aria-selected:bg-shell-foreground/10 aria-selected:text-shell-foreground aria-selected:font-semibold"
                  data-ls="187c1c9a55"
                  aria-selected={activeView === 'leaderboards'}
                  onClick={() => {
                    setActiveView('leaderboards');
                  }}
                >
                  <TrophyIcon className="shrink-0 h-4 w-4" />
                  <span className="break-words truncate">{'Leaderboards'}</span>
                </button>
              ) : null}
              {(permissions?.['matches']?.read ?? false) ||
              (permissions?.['matches']?.create ?? false) ? (
                <button
                  type="button"
                  className="flex flex-row items-center gap-3 p-2 rounded-md w-full overflow-hidden text-sm font-medium text-shell-foreground/70 hover:bg-shell-foreground/10 hover:text-shell-foreground aria-selected:bg-shell-foreground/10 aria-selected:text-shell-foreground aria-selected:font-semibold"
                  data-ls="0ff0d92f24"
                  aria-selected={activeView === 'matches'}
                  onClick={() => {
                    setActiveView('matches');
                  }}
                >
                  <SwordsIcon className="shrink-0 h-4 w-4" />
                  <span className="break-words truncate">{'Matches'}</span>
                </button>
              ) : null}
              {(permissions?.['games']?.read ?? false) ||
              (permissions?.['games']?.create ?? false) ? (
                <button
                  type="button"
                  className="flex flex-row items-center gap-3 p-2 rounded-md w-full overflow-hidden text-sm font-medium text-shell-foreground/70 hover:bg-shell-foreground/10 hover:text-shell-foreground aria-selected:bg-shell-foreground/10 aria-selected:text-shell-foreground aria-selected:font-semibold"
                  data-ls="137f2da463"
                  aria-selected={activeView === 'games'}
                  onClick={() => {
                    setActiveView('games');
                  }}
                >
                  <DicesIcon className="shrink-0 h-4 w-4" />
                  <span className="break-words truncate">{'Games'}</span>
                </button>
              ) : null}
              {(permissions?.['players']?.read ?? false) ||
              (permissions?.['players']?.create ?? false) ? (
                <button
                  type="button"
                  className="flex flex-row items-center gap-3 p-2 rounded-md w-full overflow-hidden text-sm font-medium text-shell-foreground/70 hover:bg-shell-foreground/10 hover:text-shell-foreground aria-selected:bg-shell-foreground/10 aria-selected:text-shell-foreground aria-selected:font-semibold"
                  data-ls="b487c04fca"
                  aria-selected={activeView === 'players'}
                  onClick={() => {
                    setActiveView('players');
                  }}
                >
                  <UserIcon className="shrink-0 h-4 w-4" />
                  <span className="break-words truncate">{'Players'}</span>
                </button>
              ) : null}
              <button
                type="button"
                className="flex flex-row items-center gap-3 p-2 rounded-md w-full overflow-hidden text-sm font-medium text-shell-foreground/70 hover:bg-shell-foreground/10 hover:text-shell-foreground aria-selected:bg-shell-foreground/10 aria-selected:text-shell-foreground aria-selected:font-semibold"
                data-ls="3f8d4d9916"
                aria-selected={activeView === 'gameLeaderboards'}
                onClick={() => {
                  setActiveView('gameLeaderboards');
                }}
              >
                <SparklesIcon className="shrink-0 h-4 w-4" />
                <span className="break-words truncate">{'Leaderboards by Game'}</span>
              </button>
            </nav>
          </div>
        </>
      )}

      <main
        className="ui-app-main md:pl-[var(--app-sidebar-w)] md:transition-[padding-left] md:duration-200 md:ease-in-out print:pl-0"
        style={{ paddingTop: `${headerHeight}px` }}
        data-ls-page="app"
        data-ls-home={activeView === 'dashboard' ? '' : undefined}
      >
        {activeView === 'dashboard' ? (
          <div className="grid grid-cols-[minmax(0,1fr)] h-[calc(100vh-4rem)]">
            <DashboardPanel onNavigate={onNavigate} />
          </div>
        ) : null}
        {activeView === 'leaderboards' ? <LeaderboardsList /> : null}
        {activeView === 'matches' ? <MatchesList /> : null}
        {activeView === 'games' ? <GamesList /> : null}
        {activeView === 'players' ? <PlayersList /> : null}
        {activeView === 'gameLeaderboards' ? <GameLeaderboardsSpotlight /> : null}
        {userRoles.includes('admin') && activeView === 'users' ? (
          <div className="grid grid-cols-[minmax(0,1fr)]" data-ls="6aa8780e33">
            <UserManagement />
          </div>
        ) : null}
        {userRoles.includes('admin') && activeView === 'access' ? (
          <div className="grid grid-cols-[minmax(0,1fr)]" data-ls="4566cfe45d">
            <AccessSettings />
          </div>
        ) : null}
        {userRoles.includes('admin') && activeView === 'roles' ? (
          <div className="grid grid-cols-[minmax(0,1fr)]" data-ls="d9ed528547">
            <RolePermissions />
          </div>
        ) : null}
        {userRoles.includes('admin') && activeView === 'data-protection' ? (
          <div className="grid grid-cols-[minmax(0,1fr)]" data-ls="af5c6d1ef2">
            <DataProtectionDashboard />
          </div>
        ) : null}
        {userRoles.includes('admin') && activeView === 'automation' ? (
          <div className="grid grid-cols-[minmax(0,1fr)]" data-ls="471408dbc0">
            <AutomationManagement />
          </div>
        ) : null}
        {userRoles.includes('admin') && activeView === 'stale' ? (
          <div className="grid grid-cols-[minmax(0,1fr)]" data-ls="3687499550">
            <StaleDataView />
          </div>
        ) : null}
        {userRoles.includes('admin') && activeView === 'violations' ? (
          <div className="grid grid-cols-[minmax(0,1fr)]" data-ls="b6273eec4d">
            <RuleViolationsView onNavigate={onNavigate} />
          </div>
        ) : null}

        {activeView === 'account-settings' && (
          <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 xl:py-10">
            <Tabs
              value={activeSettingsTab}
              onValueChange={(value) => {
                setActiveSettingsTab(
                  value as 'password' | 'passkeys' | '2fa' | 'privacy' | 'account'
                );
              }}
              orientation="vertical"
              className="grid grid-cols-1 lg:grid-cols-[260px_1fr] xl:grid-cols-[280px_1fr] gap-6 lg:gap-8 xl:gap-10"
            >
              <aside className="lg:sticky lg:top-14 lg:h-fit">
                <div className="border-b lg:border-b-0 lg:border-r border-border pb-4 lg:pb-0 lg:pr-6 xl:pr-8">
                  <p className="text-sm text-muted-foreground mb-6 lg:mb-8">
                    Manage account security features.
                  </p>
                  <TabsList className="flex lg:flex-col gap-1.5 bg-transparent p-0 h-auto max-lg:overflow-x-auto max-lg:-mx-4 max-lg:px-4">
                    <TabsTrigger
                      value="password"
                      className="shrink-0 whitespace-nowrap lg:w-full justify-start gap-2 px-3 lg:px-4 h-10 rounded-md text-sm font-medium text-muted-foreground hover:text-accent-foreground hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <LockIcon className="h-4 w-4" />
                      Password
                    </TabsTrigger>
                    <TabsTrigger
                      value="passkeys"
                      className="shrink-0 whitespace-nowrap lg:w-full justify-start gap-2 px-3 lg:px-4 h-10 rounded-md text-sm font-medium text-muted-foreground hover:text-accent-foreground hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <KeyRoundIcon className="h-4 w-4" />
                      Passkeys
                    </TabsTrigger>
                    <TabsTrigger
                      value="2fa"
                      className="shrink-0 whitespace-nowrap lg:w-full justify-start gap-2 px-3 lg:px-4 h-10 rounded-md text-sm font-medium text-muted-foreground hover:text-accent-foreground hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <ShieldCheckIcon className="h-4 w-4" />
                      Two-factor (2FA)
                    </TabsTrigger>
                    <TabsTrigger
                      value="privacy"
                      className="shrink-0 whitespace-nowrap lg:w-full justify-start gap-2 px-3 lg:px-4 h-10 rounded-md text-sm font-medium text-muted-foreground hover:text-accent-foreground hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <ShieldCheckIcon className="h-4 w-4" />
                      Privacy
                    </TabsTrigger>
                    {canDeleteAccount && (
                      <TabsTrigger
                        value="account"
                        className="shrink-0 whitespace-nowrap lg:w-full justify-start gap-2 px-3 lg:px-4 h-10 rounded-md text-sm font-medium text-muted-foreground hover:text-accent-foreground hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                      >
                        <Trash2Icon className="h-4 w-4" />
                        Delete account
                      </TabsTrigger>
                    )}
                  </TabsList>
                </div>
              </aside>

              <section>
                <div>
                  <div className="border border-border bg-card p-6 lg:p-8 xl:p-10 rounded-lg">
                    <TabsContent value="password">
                      <ChangePasswordSettings />
                    </TabsContent>
                    <TabsContent value="passkeys">
                      <PasskeySettings />
                    </TabsContent>
                    <TabsContent value="2fa">
                      <TwoFactorSettings />
                    </TabsContent>
                    <TabsContent value="privacy">
                      <PrivacySettings canRequestErasure={true} />
                    </TabsContent>
                    {canDeleteAccount && (
                      <TabsContent value="account">
                        <DeleteAccountSettings />
                      </TabsContent>
                    )}
                  </div>
                </div>
              </section>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}
