import { useEffect, useState } from 'react';
import { apiBaseUrl } from '../config/apiConfig';

export interface Capabilities {
  passwordReset: boolean;
  emailVerification: boolean;
  twoFactor: boolean;
  passkeys: boolean;
}

export interface SetupStatus {
  emailDelivery: boolean;
  socialProviders: string[];
  addressLookup: boolean;
  mapDisplay: boolean;
  capabilities: Capabilities;
}

export interface PlacesSetup {
  addressLookup: boolean;
  mapDisplay: boolean;
}

const NOT_CONFIGURED: SetupStatus = {
  emailDelivery: false,
  socialProviders: [],
  addressLookup: false,
  mapDisplay: false,
  capabilities: {
    passwordReset: false,
    emailVerification: false,
    twoFactor: false,
    passkeys: false,
  },
};

let pendingStatus: Promise<SetupStatus> | null = null;

function loadSetupStatus(): Promise<SetupStatus> {
  pendingStatus ??= fetch(`${apiBaseUrl}/api/setup-status`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Setup status answered ${response.status}`);
      }
      return response.json() as Promise<Partial<SetupStatus>>;
    })
    .then((data) => ({ ...NOT_CONFIGURED, ...data }));
  return pendingStatus;
}

export function useSetupStatus(): SetupStatus {
  const [status, setStatus] = useState<SetupStatus>(NOT_CONFIGURED);

  useEffect(() => {
    loadSetupStatus()
      .then(setStatus)
      .catch((error: unknown) => {
        console.error('Setup status error', error);
      });
  }, []);

  return status;
}

export function usePlacesSetup(): PlacesSetup | null {
  const [setup, setSetup] = useState<PlacesSetup | null>(null);

  useEffect(() => {
    loadSetupStatus()
      .then((status) => {
        setSetup({ addressLookup: status.addressLookup, mapDisplay: status.mapDisplay });
      })
      .catch((error: unknown) => {
        console.error('Setup status error', error);
      });
  }, []);

  return setup;
}
