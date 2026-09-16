import { useEffect, useState } from 'react';
import { apiBaseUrl } from '../config/apiConfig';

export interface SetupStatus {
  emailDelivery: boolean;
  socialProviders: string[];
  addressLookup: boolean;
  mapDisplay: boolean;
}

export interface PlacesSetup {
  addressLookup: boolean;
  mapDisplay: boolean;
}

const FULLY_CONFIGURED: SetupStatus = {
  emailDelivery: true,
  socialProviders: ['google', 'apple', 'microsoft'],
  addressLookup: true,
  mapDisplay: true,
};

let pendingStatus: Promise<SetupStatus> | null = null;

function loadSetupStatus(): Promise<SetupStatus> {
  pendingStatus ??= fetch(`${apiBaseUrl}/api/setup-status`).then(
    (response) => response.json() as Promise<SetupStatus>
  );
  return pendingStatus;
}

export function useSetupStatus(): SetupStatus {
  const [status, setStatus] = useState<SetupStatus>(FULLY_CONFIGURED);

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
