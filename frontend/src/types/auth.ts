export interface AuthResult {
  data?: {
    twoFactorRedirect?: boolean;
    session?: Session;
    user?: User;
    token?: string;
    totpURI?: string;
    backupCodes?: string[];
  } | null;
  twoFactorRedirect?: boolean;
  emailVerificationRequired?: boolean;
  error?: {
    message: string;
    code?: string;
    status?: number;
  };
}

export interface User {
  id: string;
  email: string;
  name?: string;
  image?: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  roles: string[];
}

export interface Session {
  user: User;
}

export interface TwoFactorSetup {
  totpURI: string;
  backupCodes: string[];
}
