import { i18n } from '../i18n/text';
import type { JSX } from 'react';
import { useState, useEffect, useRef } from 'react';
import { apiBaseUrl } from '../config/apiConfig';
import { Button } from './ui/button';
import { ErrorMessage } from './ui/error-message';
import { Skeleton } from './ui/skeleton';
import { apiErrorMessage, fireAndForget, runWithToast } from '../utils/errorHandling';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from './ui/alert-dialog';
import {
  ShieldCheck,
  ShieldPlus,
  ShieldMinus,
  Trash2,
  User as UserIcon,
  Calendar,
  Mail,
  Send,
  X,
  RefreshCw,
} from 'lucide-react';

const ROLE_LABELS: Record<string, (() => string) | undefined> = {
  guest: (): string => i18n.chrome.guest,
  unassigned: (): string => i18n.chrome.unassigned,
  admin: (): string => i18n.chrome.admin,
  player: (): string => i18n.word('role.player'),
  scorekeeper: (): string => i18n.word('role.scorekeeper'),
};

interface User {
  id: string;
  email: string;
  name?: string;
  emailVerified: boolean;
  createdAt: string;
  roles: string[];
}

interface Role {
  id: string;
  name: string;
  description?: string;
  isPredefined: boolean;
}

interface Invitation {
  id: string;
  email: string;
  roleId: string;
  createdAt: string;
  expiresAt: string;
}

export function UserManagement(): JSX.Element {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const roleDisplay = (roleId: string): string => {
    const name = roles.find((role) => role.id === roleId)?.name ?? roleId;
    return ROLE_LABELS[name]?.() ?? name;
  };
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingDeleteUserId, setPendingDeleteUserId] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const fetchUsers = async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/users`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(i18n.chrome.failedToFetchUsers);
      }
      const data = (await response.json()) as { users: User[] };
      setUsers(data.users);
    } catch (error) {
      setErrorMessage(i18n.chrome.failedToFetchUsers);
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchRoles = async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/roles`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(i18n.chrome.errorLoadRolesFailed);
      }
      const data = (await response.json()) as { roles: Role[] };
      const uniqueRoles = Array.from(new Map(data.roles.map((role) => [role.id, role])).values());
      setRoles(uniqueRoles);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    }
  };

  const fetchInvitations = async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/invitations`, {
        credentials: 'include',
      });
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as { invitations: Invitation[] };
      setInvitations(data.invitations);
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    }
  };

  const sendInvite = async (): Promise<void> => {
    const email = inviteEmail.trim();
    if (email === '') {
      return;
    }
    setIsInviting(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/users/invite`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, roleId: inviteRoleId }),
      });
      if (!response.ok) {
        setErrorMessage(await apiErrorMessage(response, i18n.chrome.inviteFailed));
        return;
      }
      setInviteEmail('');
      setInviteRoleId('');
      await fetchInvitations();
    } catch (error) {
      setErrorMessage(i18n.chrome.inviteFailed);
      console.error('Failed to send invitation:', error);
    } finally {
      setIsInviting(false);
    }
  };

  const revokeInvitation = async (id: string): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/invitations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        return;
      }
      await fetchInvitations();
    } catch (error) {
      console.error('Failed to revoke invitation:', error);
    }
  };

  const resendInvitation = async (id: string): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/invitations/${id}/resend`, {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        setErrorMessage(i18n.chrome.invitationResent);
      }
    } catch (error) {
      console.error('Failed to resend invitation:', error);
    }
  };

  const assignRole = async (userId: string, roleId: string): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/users/${userId}/roles/${roleId}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(i18n.chrome.failedToAssignRole);
      }
      await fetchUsers();
    } catch (error) {
      setErrorMessage(i18n.chrome.failedToAssignRole);
      console.error('Failed to assign role:', error);
    }
  };

  const removeRole = async (userId: string, roleId: string): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/users/${userId}/roles/${roleId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        setErrorMessage(await apiErrorMessage(response, i18n.chrome.failedToRemoveRole));
        return;
      }
      await fetchUsers();
    } catch (error) {
      setErrorMessage(i18n.chrome.failedToRemoveRole);
      console.error('Failed to remove role:', error);
    }
  };

  const deleteUser = async (userId: string): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(i18n.chrome.failedToDeleteUser);
      }
      await fetchUsers();
    } catch (error) {
      setErrorMessage(i18n.chrome.failedToDeleteUser);
      console.error('Failed to delete user:', error);
    }
  };

  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) {
      return;
    }
    loadedRef.current = true;
    Promise.all([fetchUsers(), fetchRoles(), fetchInvitations()])
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
        <h1 className="text-2xl lg:text-3xl font-bold mb-2 break-words" data-ls="375704d2ef">
          {i18n.chrome.userManagementTitle}
        </h1>
        <p className="text-muted-foreground">{i18n.chrome.userManagementSubtitle}</p>
      </div>

      {errorMessage && (
        <div className="mb-4">
          <ErrorMessage message={errorMessage} />
        </div>
      )}

      <div className="mb-6 bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-1">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-base font-semibold">{i18n.chrome.inviteUserTitle}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{i18n.chrome.inviteUserDescription}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => {
              setInviteEmail(e.target.value);
            }}
            placeholder={i18n.chrome.inviteEmailPlaceholder}
            aria-label={i18n.chrome.inviteUserTitle}
            className="w-full min-w-0 sm:flex-1 h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          />
          <select
            value={inviteRoleId}
            onChange={(e) => {
              setInviteRoleId(e.target.value);
            }}
            aria-label={i18n.chrome.inviteRoleLabel}
            className="h-10 min-w-0 rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            <option value="">{i18n.chrome.inviteNoRoleOption}</option>
            {roles
              .filter((role) => role.name !== 'guest' && role.name !== 'unassigned')
              .map((role) => (
                <option key={role.id} value={role.id}>
                  {ROLE_LABELS[role.name]?.() ?? role.name}
                </option>
              ))}
          </select>
          <Button
            className="gap-2 h-10"
            disabled={isInviting || inviteEmail.trim() === ''}
            onClick={() => {
              runWithToast(sendInvite());
            }}
          >
            <Send className="h-4 w-4" />
            {isInviting ? i18n.chrome.inviteSending : i18n.chrome.inviteButton}
          </Button>
        </div>

        <div className="mt-6">
          <h4 className="text-sm font-medium mb-3">{i18n.chrome.pendingInvitationsTitle}</h4>
          {invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{i18n.chrome.noPendingInvitations}</p>
          ) : (
            <div className="space-y-2">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{invitation.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {invitation.roleId !== ''
                        ? roleDisplay(invitation.roleId)
                        : i18n.chrome.inviteNoRoleOption}
                      {' · '}
                      {i18n.chrome.invitationExpiresLabel}{' '}
                      {new Date(invitation.expiresAt).toLocaleDateString(i18n.locale)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        runWithToast(resendInvitation(invitation.id));
                      }}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-secondary-foreground transition-colors"
                      aria-label={i18n.chrome.invitationResend}
                      title={i18n.chrome.invitationResend}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        runWithToast(revokeInvitation(invitation.id));
                      }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive-text hover:bg-secondary hover:text-secondary-foreground transition-colors"
                      aria-label={i18n.chrome.invitationRevoke}
                      title={i18n.chrome.invitationRevoke}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {users.map((user) => (
          <div
            key={user.id}
            className="bg-card border border-border rounded-lg p-6 hover:border-primary transition-colors"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <UserIcon className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-lg font-semibold truncate">{user.email}</h3>
                </div>
                <div className="flex min-w-0 flex-wrap gap-3 text-sm text-muted-foreground [&>*]:max-w-full">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span className="min-w-0 truncate">
                      {new Date(user.createdAt).toLocaleDateString(i18n.locale)}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="accent"
                size="sm"
                className="gap-2"
                onClick={() => {
                  setPendingDeleteUserId(user.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
                {i18n.chrome.delete}
              </Button>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                {i18n.chrome.roles}
              </h4>
              <div className="flex flex-wrap gap-2 mb-4">
                {user.roles.length > 0 ? (
                  user.roles.map((roleName) => {
                    const role = roles.find((r) => r.name === roleName);
                    return role ? (
                      <div
                        key={role.id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 text-primary-text text-sm font-medium"
                      >
                        <span>{ROLE_LABELS[role.name]?.() ?? role.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            runWithToast(removeRole(user.id, role.id));
                          }}
                          className="hover:text-accent-text transition-colors"
                          aria-label={i18n.chrome.removeRole}
                        >
                          <ShieldMinus className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null;
                  })
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {i18n.chrome.noRolesAssigned}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {roles
                  .filter(
                    (role) =>
                      role.name !== 'guest' &&
                      role.name !== 'unassigned' &&
                      !user.roles.includes(role.name)
                  )
                  .map((role) => (
                    <Button
                      key={role.id}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        runWithToast(assignRole(user.id, role.id));
                      }}
                    >
                      <ShieldPlus className="h-4 w-4" />
                      {i18n.chrome.addRole} {ROLE_LABELS[role.name]?.() ?? role.name}
                    </Button>
                  ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <AlertDialog
        open={pendingDeleteUserId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteUserId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{i18n.chrome.deleteUserTitle}</AlertDialogTitle>
            <AlertDialogDescription>{i18n.chrome.deleteUserConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline">{i18n.chrome.cancel}</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={() => {
                  if (pendingDeleteUserId !== null) {
                    fireAndForget(deleteUser(pendingDeleteUserId));
                    setPendingDeleteUserId(null);
                  }
                }}
              >
                {i18n.chrome.delete}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
