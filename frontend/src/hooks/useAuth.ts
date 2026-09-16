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
import { authClient } from '../api/authClient.js';
import type { AuthResult, Session, User } from '../types/auth.js';
import { apiBaseUrl } from '../config/apiConfig.js';
import {
  checkReachable,
  reportRequestFailure,
  subscribeConnectivity,
} from '../utils/connectivity.js';
import { AuthRequestError, apiErrorMessage } from '../utils/errorHandling.js';

const SESSION_POLL_INTERVAL_MS = 30000;
const ACTIVITY_REFRESH_DELAY_MS = 5000;
const USER_ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const;

export interface AuthContextValue {
  session: Session | null;
  isLoading: boolean;
  isReady: boolean;
  isAuthenticated: boolean;
  user: User | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (
    email: string,
    password: string,
    name: string,
    inviteToken: string | null
  ) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  verifyTwoFactor: (code: string) => Promise<AuthResult>;
  enableTwoFactor: (password?: string) => Promise<AuthResult>;
  disableTwoFactor: (password?: string) => Promise<AuthResult>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  resendVerificationEmail: (email: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactElement {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const initialSessionCheckedRef = useRef(false);

  const fetchSession = useCallback(async (): Promise<void> => {
    try {
      const response = await authClient.getSession();
      const loaded = response.data as Session | null;
      if (loaded === null && !(await checkReachable())) {
        return;
      }
      setSession(loaded);
    } catch (error) {
      console.error('Failed to refresh session, keeping the last known one', error);
      reportRequestFailure();
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<void> => {
    await fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    const loadInitialSession = async (): Promise<void> => {
      let loaded: Session | null = null;
      try {
        const response = await authClient.getSession();
        loaded = response.data as Session | null;
      } catch (error) {
        console.error('Failed to get session', error);
      }
      if (loaded === null && !(await checkReachable())) {
        return;
      }
      setSession(loaded);
      setIsLoading(false);
      setIsReady(true);
      initialSessionCheckedRef.current = true;
    };

    loadInitialSession().catch((error) => {
      console.error('Initial session check error', error);
    });

    const unsubscribeConnectivity = subscribeConnectivity((state) => {
      if (state === 'restored' && !initialSessionCheckedRef.current) {
        loadInitialSession().catch((error) => {
          console.error('Initial session check error', error);
        });
      }
    });

    const pollingInterval = setInterval(() => {
      fetchSession().catch((error) => {
        console.error('Session check error', error);
      });
    }, SESSION_POLL_INTERVAL_MS);

    let activityTimeout: ReturnType<typeof setTimeout> | null = null;
    const refreshOnActivity = (): void => {
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      activityTimeout = setTimeout(() => {
        fetchSession().catch((error) => {
          console.error('Activity-based session refresh error', error);
        });
      }, ACTIVITY_REFRESH_DELAY_MS);
    };

    USER_ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, refreshOnActivity, { passive: true });
    });

    return (): void => {
      clearInterval(pollingInterval);
      unsubscribeConnectivity();
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      USER_ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, refreshOnActivity);
      });
    };
  }, [fetchSession]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const result = (await authClient.signIn.email({ email, password })) as AuthResult;

      if (result.error) {
        if (result.error.code === 'EMAIL_NOT_VERIFIED') {
          return { ...result, emailVerificationRequired: true };
        }
        throw new AuthRequestError(result.error, 'Authentication failed');
      }

      const needsTwoFactorVerification =
        result.data?.twoFactorRedirect === true || result.twoFactorRedirect === true;

      if (needsTwoFactorVerification) {
        return result;
      }

      await refreshSession();

      return result;
    },
    [refreshSession]
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      name: string,
      inviteToken: string | null
    ): Promise<AuthResult> => {
      const result = (await authClient.signUp.email({
        email,
        password,
        name,
        ...(inviteToken === null ? {} : { inviteToken }),
      })) as AuthResult;

      if (result.error) {
        throw new AuthRequestError(result.error, 'Registration failed');
      }

      const emailVerificationRequired = !result.data?.token;
      await refreshSession();
      return { ...result, emailVerificationRequired };
    },
    [refreshSession]
  );

  const resendVerificationEmail = useCallback(async (email: string): Promise<void> => {
    const result = (await authClient.sendVerificationEmail({ email })) as AuthResult;

    if (result.error) {
      throw new AuthRequestError(result.error, 'Could not resend the email. Try again.');
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await authClient.signOut();
    } catch (error) {
      console.error('Failed to sign out', error);
    }
    try {
      await fetch(`${apiBaseUrl}/api/session-cookie`, { method: 'DELETE', credentials: 'include' });
    } catch (error) {
      console.error('Failed to clear session cookie', error);
    }
    setSession(null);
  }, []);

  const verifyTwoFactor = useCallback(
    async (code: string): Promise<AuthResult> => {
      const twoFactor = authClient.twoFactor as {
        verify?: (params: { code: string }) => Promise<unknown>;
        verifyTotp?: (params: { code: string }) => Promise<unknown>;
      };
      const verifyMethod = twoFactor.verifyTotp ?? twoFactor.verify;

      if (!verifyMethod) {
        throw new Error('2FA verify method not available');
      }

      const result = (await verifyMethod({ code })) as AuthResult;

      if (result.error) {
        throw new AuthRequestError(result.error, 'Invalid verification code');
      }

      await refreshSession();
      return result;
    },
    [refreshSession]
  );

  const enableTwoFactor = useCallback(async (password?: string): Promise<AuthResult> => {
    const result = (await authClient.twoFactor.enable({
      password: password ?? '',
    })) as AuthResult;

    if (result.error) {
      throw new AuthRequestError(result.error, 'Failed to enable two-factor authentication');
    }

    return result;
  }, []);

  const disableTwoFactor = useCallback(
    async (password?: string): Promise<AuthResult> => {
      const result = (await authClient.twoFactor.disable({
        password: password ?? '',
      })) as AuthResult;

      if (result.error) {
        throw new AuthRequestError(result.error, 'Failed to disable two-factor authentication');
      }

      await refreshSession();
      return result;
    },
    [refreshSession]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<AuthResult> => {
      const result = (await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      })) as AuthResult;

      if (result.error) {
        throw new AuthRequestError(
          result.error,
          'Could not change your password. Please try again.'
        );
      }

      await refreshSession();
      return result;
    },
    [refreshSession]
  );

  const deleteAccount = useCallback(async (): Promise<void> => {
    const response = await fetch(`${apiBaseUrl}/api/account`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(await apiErrorMessage(response, 'Your account could not be deleted.'));
    }
    await signOut();
  }, [signOut]);

  return createElement(
    AuthContext.Provider,
    {
      value: {
        session,
        isLoading,
        isReady,
        isAuthenticated: Boolean(session?.user),
        user: session?.user ?? null,
        signIn,
        signUp,
        signOut,
        verifyTwoFactor,
        enableTwoFactor,
        disableTwoFactor,
        changePassword,
        resendVerificationEmail,
        deleteAccount,
      },
    },
    children
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
