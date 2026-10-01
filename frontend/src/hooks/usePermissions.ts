import { i18n } from '../i18n/text';
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactElement,
  type ReactNode,
} from 'react';
import { apiBaseUrl } from '../config/apiConfig.js';
import { useAuth } from './useAuth.js';
import { checkReachable, reportReachable, subscribeConnectivity } from '../utils/connectivity.js';

export interface ResourcePermissions {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  call?: Record<string, boolean>;
  readFields?: string[] | null;
  updateFields?: string[] | null;
  createFields?: string[] | null;
}

export type PermissionsMap = Record<string, ResourcePermissions | undefined>;

export function canReadField(
  permissions: PermissionsMap | null,
  resourceName: string,
  field: string
): boolean {
  if (!permissions) {
    return true;
  }
  const resource = permissions[resourceName];
  if (!resource?.readFields) {
    return true;
  }
  return resource.readFields.includes(field);
}

export function canReadCollection(
  permissions: PermissionsMap | null,
  resourceName: string
): boolean {
  if (!permissions) {
    return false;
  }
  return permissions[resourceName]?.read ?? true;
}

export function canUpdateField(
  permissions: PermissionsMap | null,
  resourceName: string,
  field: string
): boolean {
  if (!permissions) {
    return true;
  }
  const resource = permissions[resourceName];
  if (!canReadField(permissions, resourceName, field)) {
    return false;
  }
  if (!resource?.updateFields) {
    return true;
  }
  return resource.updateFields.includes(field);
}

export function canCreateField(
  permissions: PermissionsMap | null,
  resourceName: string,
  field: string
): boolean {
  if (!permissions) {
    return true;
  }
  const resource = permissions[resourceName];
  if (!resource?.createFields) {
    return true;
  }
  return resource.createFields.includes(field);
}

interface PermissionsContextValue {
  permissions: PermissionsMap | null;
  hasManagementAccess: boolean;
  hasAppAccess: boolean;
  isAdmin: boolean;
  allowAccountDeletion: boolean;
  showStaleData: boolean;
  roles: string[];
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export function PermissionsProvider({ children }: { children: ReactNode }): ReactElement {
  const [permissions, setPermissions] = useState<PermissionsMap | null>(null);
  const [hasManagementAccess, setHasManagementAccess] = useState(false);
  const [hasAppAccess, setHasAppAccess] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allowAccountDeletion, setAllowAccountDeletion] = useState(false);
  const [showStaleData, setShowStaleData] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isReady } = useAuth();

  const fetchPermissions = useCallback(async (): Promise<void> => {
    let unreachable = false;
    try {
      const response = await fetch(`${apiBaseUrl}/api/permissions`, {
        credentials: 'include',
      });
      reportReachable();
      if (!response.ok) {
        throw new Error(i18n.chrome.errorLoadPermissionsFailed);
      }
      const data = (await response.json()) as {
        permissions: PermissionsMap;
        hasManagementAccess?: boolean;
        hasAppAccess?: boolean;
        isAdmin?: boolean;
        allowAccountDeletion?: boolean;
        showStaleData?: boolean;
        roles?: string[];
      };
      setPermissions(data.permissions);
      setHasManagementAccess(data.hasManagementAccess ?? false);
      setHasAppAccess(data.hasAppAccess ?? false);
      setIsAdmin(data.isAdmin ?? false);
      setAllowAccountDeletion(data.allowAccountDeletion ?? false);
      setShowStaleData(data.showStaleData ?? false);
      setRoles(data.roles ?? []);
    } catch (error) {
      if (!(await checkReachable())) {
        unreachable = true;
        return;
      }
      console.error('Failed to fetch permissions', error);
      setPermissions({});
      setHasManagementAccess(false);
      setHasAppAccess(false);
      setIsAdmin(false);
      setAllowAccountDeletion(false);
      setShowStaleData(false);
      setRoles([]);
    } finally {
      if (!unreachable) {
        setIsLoading(false);
      }
    }
  }, []);

  const loadedFetchRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    if (loadedFetchRef.current !== fetchPermissions) {
      loadedFetchRef.current = fetchPermissions;
      fetchPermissions().catch((error) => {
        console.error('Failed to fetch permissions', error);
      });
    }
    return subscribeConnectivity((state) => {
      if (state === 'restored') {
        fetchPermissions().catch((error) => {
          console.error('Failed to fetch permissions', error);
        });
      }
    });
  }, [isReady, fetchPermissions]);

  return createElement(
    PermissionsContext.Provider,
    {
      value: {
        permissions,
        hasManagementAccess,
        hasAppAccess,
        isAdmin,
        allowAccountDeletion,
        showStaleData,
        roles,
        isLoading,
        refetch: fetchPermissions,
      },
    },
    children
  );
}

export function usePermissions(): {
  permissions: PermissionsMap | null;
  isLoading: boolean;
  hasManagementAccess: boolean;
  hasAppAccess: boolean;
  isAdmin: boolean;
  allowAccountDeletion: boolean;
  showStaleData: boolean;
  roles: string[];
  canAccess: (resourceName: string) => boolean;
  refetch: () => Promise<void>;
} {
  const context = useContext(PermissionsContext);
  const permissions = context?.permissions ?? null;
  const isLoading = context?.isLoading ?? true;
  const refetch = context?.refetch ?? ((): Promise<void> => Promise.resolve());

  const hasManagementAccess = context?.hasManagementAccess ?? false;
  const hasAppAccess = context?.hasAppAccess ?? false;
  const isAdmin = context?.isAdmin ?? false;
  const allowAccountDeletion = context?.allowAccountDeletion ?? false;
  const showStaleData = context?.showStaleData ?? false;
  const roles = context?.roles ?? [];

  const canAccess = useCallback(
    (resourceName: string): boolean => {
      if (!permissions) {
        return false;
      }
      const resourcePermissions = permissions[resourceName];
      if (!resourcePermissions) {
        return false;
      }
      return resourcePermissions.read || resourcePermissions.create;
    },
    [permissions]
  );

  return {
    permissions,
    isLoading,
    hasManagementAccess,
    hasAppAccess,
    isAdmin,
    allowAccountDeletion,
    showStaleData,
    roles,
    canAccess,
    refetch,
  };
}
