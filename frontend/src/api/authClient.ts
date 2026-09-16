import { createAuthClient } from 'better-auth/client';
import { twoFactorClient } from 'better-auth/client/plugins';
import { passkeyClient } from '@better-auth/passkey/client';
import { apiBaseUrl } from '../config/apiConfig.js';

export const authClient = createAuthClient({
  baseURL: apiBaseUrl,
  plugins: [twoFactorClient(), passkeyClient()],
});
