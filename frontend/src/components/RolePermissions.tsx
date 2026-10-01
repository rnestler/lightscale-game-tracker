import { i18n } from '../i18n/text';
import type { JSX } from 'react';
import { useState, useEffect, useRef } from 'react';
import { apiBaseUrl } from '../config/apiConfig';
import { humanize } from '../utils/errorHandling';
import { ErrorMessage } from './ui/error-message';
import { Skeleton } from './ui/skeleton';

type GrantScope = 'all' | 'own' | null;
type OperationKey = 'read' | 'create' | 'update' | 'delete';
type PermissionRow = Record<OperationKey, GrantScope>;

interface PermissionView {
  roles: string[];
  paths: string[];
  matrix: Record<string, Record<string, PermissionRow>>;
}

interface GrantedOperation {
  key: OperationKey;
  label: string;
  scope: 'all' | 'own';
}

const RESOURCE_LABELS: Record<string, (() => string) | undefined> = {
  games: (): string => i18n.word('games'),
  'games.leaderboard': (): string => `${i18n.word('games')} › ${i18n.word('GameType.leaderboard')}`,
  players: (): string => i18n.word('players'),
  matches: (): string => i18n.word('matches'),
  leaderboards: (): string => i18n.word('leaderboards'),
};

const ROLE_LABELS: Record<string, (() => string) | undefined> = {
  guest: (): string => i18n.chrome.guest,
  unassigned: (): string => i18n.chrome.unassigned,
  admin: (): string => i18n.chrome.admin,
  player: (): string => i18n.word('role.player'),
  scorekeeper: (): string => i18n.word('role.scorekeeper'),
};

const OPERATIONS: Array<{ key: OperationKey; label: () => string }> = [
  { key: 'read', label: (): string => i18n.chrome.rolePermissionsReadChip },
  { key: 'create', label: (): string => i18n.chrome.rolePermissionsCreateChip },
  { key: 'update', label: (): string => i18n.chrome.rolePermissionsUpdateChip },
  { key: 'delete', label: (): string => i18n.chrome.rolePermissionsDeleteChip },
];

function resourceLabel(path: string): string {
  return RESOURCE_LABELS[path]?.() ?? path.split('.').map(humanize).join(' › ');
}

function roleLabel(role: string): string {
  return ROLE_LABELS[role]?.() ?? humanize(role);
}

function grantedOperations(row: PermissionRow): GrantedOperation[] {
  const granted: GrantedOperation[] = [];
  for (const operation of OPERATIONS) {
    const scope = row[operation.key] ?? null;
    if (scope !== null) {
      granted.push({ key: operation.key, label: operation.label(), scope });
    }
  }
  return granted;
}

function PermissionCell({ row }: { row: PermissionRow }): JSX.Element {
  const granted = grantedOperations(row);
  if (granted.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">{i18n.chrome.rolePermissionsNoAccess}</span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {granted.map((operation) => (
        <span
          key={operation.key}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary-text"
        >
          <span>{operation.label}</span>
          <span className="opacity-70">
            {operation.scope === 'all' ? i18n.chrome.scopeAll : i18n.chrome.scopeOwn}
          </span>
        </span>
      ))}
    </div>
  );
}

export function RolePermissions(): JSX.Element {
  const [view, setView] = useState<PermissionView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchView = async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/roles/permissions`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(i18n.chrome.failedToFetchPermissions);
      }
      const data = (await response.json()) as PermissionView;
      setView(data);
    } catch (error) {
      setErrorMessage(i18n.chrome.failedToFetchPermissions);
      console.error('Failed to fetch role permissions:', error);
    }
  };

  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) {
      return;
    }
    loadedRef.current = true;
    fetchView()
      .then(() => {
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-start justify-center h-96">
        <div
          role="status"
          aria-label={i18n.chrome.loading}
          className="rounded-xl border border-border bg-card w-full max-w-2xl p-6 space-y-3"
        >
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 xl:py-10 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold mb-2 break-words" data-ls="e0d24108ee">
          {i18n.chrome.rolePermissionsTitle}
        </h1>
        <p className="text-muted-foreground">{i18n.chrome.rolePermissionsSubtitle}</p>
      </div>

      {errorMessage && (
        <div className="mb-4">
          <ErrorMessage message={errorMessage} />
        </div>
      )}

      {view && (
        <div className="border border-border rounded-lg overflow-x-auto bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="text-left px-4 py-3 font-semibold">
                  {i18n.chrome.rolePermissionsPathHeader}
                </th>
                {view.roles.map((role) => (
                  <th key={role} className="text-left px-4 py-3 font-semibold">
                    {roleLabel(role)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.paths.map((path) => (
                <tr key={path} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 font-medium align-top whitespace-nowrap">
                    {resourceLabel(path)}
                  </td>
                  {view.roles.map((role) => (
                    <td key={role} className="px-4 py-3 align-top">
                      <PermissionCell row={view.matrix[role][path]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
