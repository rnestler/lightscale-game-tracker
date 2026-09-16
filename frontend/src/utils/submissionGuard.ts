import { apiBaseUrl } from '../config/apiConfig';
import { apiRequestError } from './errorHandling';

export interface IssuedSubmissionToken {
  token: string;
  lifetimeMs: number;
  minimumFillMs: number;
}

const EXPIRY_MARGIN_MS = 60000;

const guard = { token: '', armedAt: 0, lifetimeMs: 0, minimumFillMs: 0, trap: '' };

export function armSubmissionToken(issued: IssuedSubmissionToken): void {
  guard.token = issued.token;
  guard.armedAt = Date.now();
  guard.lifetimeMs = issued.lifetimeMs;
  guard.minimumFillMs = issued.minimumFillMs;
}

export function markSubmissionTrap(value: string): void {
  guard.trap = value;
}

function tokenExpiring(): boolean {
  return guard.token !== '' && Date.now() - guard.armedAt + EXPIRY_MARGIN_MS >= guard.lifetimeMs;
}

async function refreshExpiringToken(): Promise<void> {
  if (!tokenExpiring()) {
    return;
  }
  const response = await fetch(`${apiBaseUrl}/api/submission-token`, { credentials: 'include' });
  if (!response.ok) {
    throw await apiRequestError(response, 'save');
  }
  armSubmissionToken((await response.json()) as IssuedSubmissionToken);
  await new Promise((resolve) => {
    setTimeout(resolve, guard.minimumFillMs);
  });
}

export async function submissionHeaders(): Promise<Record<string, string>> {
  await refreshExpiringToken();
  const headers: Record<string, string> = {};
  if (guard.token !== '') {
    headers['X-Submission-Token'] = guard.token;
  }
  if (guard.trap !== '') {
    headers['X-Submission-Trap'] = guard.trap;
  }
  return headers;
}
