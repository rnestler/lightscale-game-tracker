// Generated with Lightscale AI. This file belongs to the owner of the generated application. See LICENSE.
import { i18n } from '../i18n/text';
import { useEffect, useState } from 'react';
import { apiBaseUrl } from '../config/apiConfig.js';

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
}

let cachedUsers: DirectoryUser[] | null = null;
let pendingUsers: Promise<DirectoryUser[]> | null = null;

function loadUsers(): Promise<DirectoryUser[]> {
  if (cachedUsers) {
    return Promise.resolve(cachedUsers);
  }
  pendingUsers ??= fetch(`${apiBaseUrl}/api/users`, { credentials: 'include' })
    .then((response) => response.json() as Promise<{ users: DirectoryUser[] }>)
    .then((data) => {
      cachedUsers = data.users;
      return data.users;
    });
  return pendingUsers;
}

export function useUsers(): { userLabel: (id: string | undefined) => string } {
  const [users, setUsers] = useState<DirectoryUser[]>(cachedUsers ?? []);

  useEffect(() => {
    let active = true;
    loadUsers()
      .then((list) => {
        if (active) {
          setUsers(list);
        }
      })
      .catch(() => undefined);
    return (): void => {
      active = false;
    };
  }, []);

  function userLabel(id: string | null | undefined): string {
    if (id === undefined || id === null || id === '') {
      return '';
    }
    const user = users.find((entry) => entry.id === id);
    if (!user) {
      return i18n.chrome.unknownUser;
    }
    return user.name || user.email || i18n.chrome.unknownUser;
  }

  return { userLabel };
}
