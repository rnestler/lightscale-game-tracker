import { apiBaseUrl } from '../config/apiConfig';
import { apiRequestError } from './errorHandling';

export interface IssuedSubmissionToken {
  token: string;
  lifetimeMs: number;
}

const EXPIRY_MARGIN_MS = 60000;
const MINIMUM_FILL_MS = 1500;

const guard = { token: '', armedAt: 0, lifetimeMs: 0, used: false, trap: '' };

export function armSubmissionToken(issued: IssuedSubmissionToken): void {
  guard.token = issued.token;
  guard.armedAt = Date.now();
  guard.lifetimeMs = issued.lifetimeMs;
  guard.used = false;
}

export function markSubmissionTrap(value: string): void {
  guard.trap = value;
}

function tokenExpiring(): boolean {
  return Date.now() - guard.armedAt + EXPIRY_MARGIN_MS >= guard.lifetimeMs;
}

async function freshToken(): Promise<void> {
  if (guard.used || tokenExpiring()) {
    const response = await fetch(`${apiBaseUrl}/api/submission-token`, { credentials: 'include' });
    if (!response.ok) {
      throw await apiRequestError(response, 'save');
    }
    armSubmissionToken((await response.json()) as IssuedSubmissionToken);
  }
  const remaining = guard.armedAt + MINIMUM_FILL_MS - Date.now();
  if (remaining > 0) {
    await new Promise((resolve) => {
      setTimeout(resolve, remaining);
    });
  }
}

export async function submissionHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (guard.token !== '') {
    await freshToken();
    headers['X-Submission-Token'] = guard.token;
    guard.used = true;
  }
  if (guard.trap !== '') {
    headers['X-Submission-Trap'] = guard.trap;
  }
  return headers;
}
