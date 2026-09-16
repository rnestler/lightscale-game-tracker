const configuredApiUrl: unknown = import.meta.env.VITE_API_URL;
const backendPort: unknown = import.meta.env.VITE_BACKEND_PORT;

function developmentApiUrl(): string {
  return `http://localhost:${typeof backendPort === 'string' && backendPort !== '' ? backendPort : '3500'}`;
}

function unconfiguredApiUrl(): string {
  return import.meta.env.DEV ? developmentApiUrl() : window.location.origin;
}

export const apiBaseUrl =
  typeof configuredApiUrl === 'string' && configuredApiUrl !== ''
    ? configuredApiUrl.replace(/\/+$/, '')
    : unconfiguredApiUrl();
