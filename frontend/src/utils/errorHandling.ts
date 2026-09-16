import { toast } from './toast';
import { fieldLabel, fieldLabels, recordName, recordPlural } from './recordNames';

export type RequestKind = 'load' | 'save';

const GATEWAY_STATUSES = new Set([502, 503, 504]);

export function getErrorMessage(error: unknown, defaultMessage = 'Unknown error'): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return defaultMessage;
}

export function runWithToast(action: Promise<unknown>): void {
  action.catch((error: unknown) => {
    toast(getErrorMessage(error), 'error');
  });
}

export function fireAndForget(action: Promise<unknown> | void): void {
  Promise.resolve(action).catch((error: unknown) => {
    console.error(error);
  });
}

const CODE_MESSAGES: Record<string, string> = {
  AUTHENTICATION_REQUIRED: 'Your session has ended. Please sign in again.',
  UNAUTHORIZED: 'You are not authorized to do this.',
  ADMIN_REQUIRED: 'This action requires an admin role.',
  APP_ACCESS_REQUIRED: 'This action requires access to the software.',
  ROLE_NAME_MISSING: 'A role name is required.',
  ROLE_NOT_FOUND: 'That role does not exist.',
  ROLE_ASSIGNMENT_NOT_FOUND: 'That role assignment does not exist.',
  CANNOT_REMOVE_OWN_ADMIN_ROLE: 'You cannot remove your own admin role.',
  CANNOT_DELETE_SELF: 'You cannot delete your own account.',
  REFERENCE_CONFLICT: 'This record is still used by other records and cannot be deleted.',
  AI_NOT_CONFIGURED:
    'This step needs the AI service, which is not configured. Please contact your administrator.',
  DERIVED_SORT_LIMIT: 'This list holds too many records to sort by a calculated field.',
  EMAIL_REQUIRED: 'Enter a valid email address.',
  USER_ALREADY_EXISTS: 'An account with this email already exists.',
  INVITATION_EXISTS: 'An invitation for this email already exists.',
  INVITATION_NOT_FOUND: 'This invitation no longer exists.',
  ACCOUNT_DELETION_DISABLED: 'Account deletion is disabled.',
  ADMIN_CANNOT_DELETE_ACCOUNT: 'Administrators cannot delete their own account.',
  SUBMISSION_REJECTED: 'Reload the page before submitting again.',
  SUBMISSION_TOO_EARLY: 'The form was sent too quickly. Wait a moment, then send it again.',
};

export async function apiErrorMessage(response: Response, fallback: string): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as { code?: string };
  const known = data.code === undefined ? undefined : CODE_MESSAGES[data.code];
  return known ?? fallback;
}

const AUTH_CODE_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'Invalid email or password.',
  INVALID_PASSWORD: 'Invalid password. Please try again.',
  INVALID_EMAIL: 'Enter a valid email address.',
  USER_ALREADY_EXISTS: 'An account with this email already exists.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'An account with this email already exists.',
  PASSWORD_TOO_SHORT: 'The password is too short.',
  PASSWORD_TOO_LONG: 'The password is too long.',
  CREDENTIAL_ACCOUNT_NOT_FOUND: 'This account signs in without a password.',
  INVALID_TOKEN: 'This link is invalid or has expired.',
  TOKEN_EXPIRED: 'This link is invalid or has expired.',
  SESSION_EXPIRED: 'Your session has ended. Please sign in again.',
  INVALID_CODE: 'Invalid verification code',
  INVALID_BACKUP_CODE: 'Invalid verification code',
  OTP_HAS_EXPIRED: 'The code has expired. Please request a new one.',
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: 'Too many attempts. Please try again later.',
  ACCOUNT_TEMPORARILY_LOCKED: 'Too many attempts. Please try again later.',
  PASSKEY_NOT_FOUND: 'No passkey found. Please register a passkey first in Settings.',
  AUTHENTICATION_FAILED: 'Passkey authentication failed',
  PREVIOUSLY_REGISTERED: 'This passkey is already registered.',
  SIGNUP_INVITATION_REQUIRED:
    'Sign-up is by invitation only. Use the invitation link sent to your email.',
};

export interface AuthFailure {
  code?: string;
  status?: number;
  message?: string;
}

export function authErrorMessage(failure: AuthFailure, fallback: string): string {
  const known = failure.code === undefined ? undefined : AUTH_CODE_MESSAGES[failure.code];
  if (known !== undefined) {
    return known;
  }
  return failure.status === 429 ? 'Too many attempts. Please try again later.' : fallback;
}

export class AuthRequestError extends Error {
  readonly code: string | undefined;

  constructor(failure: AuthFailure, fallback: string) {
    super(authErrorMessage(failure, fallback));
    this.code = failure.code;
  }
}

export function isInvalidPasswordError(error: unknown): boolean {
  return error instanceof AuthRequestError && error.code === 'INVALID_PASSWORD';
}

function failureCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}

export function isCancelledAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.name === 'NotAllowedError' || error.name === 'AbortError';
  }
  const code = failureCode(error);
  return code === 'AUTH_CANCELLED' || code === 'REGISTRATION_CANCELLED';
}

function permissionDeniedMessage(serverMessage: string | undefined): string {
  const pattern = /for (\w+) on ([\w.]+)/;
  const match = serverMessage === undefined ? null : pattern.exec(serverMessage);
  if (match === null) {
    return 'You do not have permission to perform this action. Please contact your administrator.';
  }
  const resource = match[2];
  return `You do not have permission for ${resource}. Please contact your administrator to request access.`;
}

type StringFormat = 'email' | 'phone' | 'url' | 'country';

export type Refusal =
  | { kind: 'frozen'; type: string }
  | { kind: 'required'; type: string; field: string }
  | { kind: 'format'; type: string; field: string; format: StringFormat }
  | { kind: 'rule'; type: string; fields: string[] }
  | { kind: 'unique'; type: string; fields: string[] }
  | { kind: 'exclusive'; type: string; partition: string[]; interval: string[] }
  | { kind: 'capacity'; type: string; limit: number }
  | { kind: 'recordGone'; type: string }
  | { kind: 'recordOwned'; type: string }
  | { kind: 'referenceGone'; type: string; field: string }
  | { kind: 'orderLineGone' }
  | { kind: 'orderEmpty' }
  | { kind: 'precondition' }
  | { kind: 'stated'; message: string };

export class ApiRequestError extends Error {
  readonly refusal: Refusal | null;

  constructor(message: string, refusal: Refusal | null) {
    super(message);
    this.refusal = refusal;
  }
}

function refusalFields(refusal: Refusal): string[] {
  switch (refusal.kind) {
    case 'required':
    case 'format':
    case 'referenceGone':
      return [refusal.field];
    case 'rule':
    case 'unique':
      return refusal.fields;
    case 'exclusive':
      return [...refusal.partition, ...refusal.interval];
    case 'frozen':
    case 'capacity':
    case 'recordGone':
    case 'recordOwned':
    case 'orderLineGone':
    case 'orderEmpty':
    case 'precondition':
    case 'stated':
      return [];
  }
}

export function refusalFieldErrors(
  error: unknown,
  formFields: readonly string[]
): Record<string, string> | null {
  if (!(error instanceof ApiRequestError) || error.refusal === null) {
    return null;
  }
  const named = refusalFields(error.refusal).filter((field) => formFields.includes(field));
  if (named.length === 0) {
    return null;
  }
  const errors: Record<string, string> = {};
  for (const field of named) {
    errors[field] = error.message;
  }
  return errors;
}

export function humanize(identifier: string): string {
  const spaced = identifier.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatMessage(format: StringFormat): string {
  switch (format) {
    case 'email':
      return 'Enter a valid email address.';
    case 'phone':
      return 'Enter a valid phone number.';
    case 'url':
      return 'Enter a valid web address.';
    case 'country':
      return 'Select a valid country.';
  }
}

function refusalMessage(refusal: Refusal): string {
  switch (refusal.kind) {
    case 'stated':
      return refusal.message;
    case 'frozen':
      return 'This __RECORD__ can no longer be changed.'.replace(
        '__RECORD__',
        recordName(refusal.type)
      );
    case 'format':
      return formatMessage(refusal.format);
    case 'required':
      return '__LABEL__ is required.'.replace('__LABEL__', fieldLabel(refusal.type, refusal.field));
    case 'rule':
      return refusal.fields.length === 1
        ? 'The value in __LABELS__ is not allowed here.'.replace(
            '__LABELS__',
            fieldLabels(refusal.type, refusal.fields)
          )
        : 'The values in __LABELS__ do not go together.'.replace(
            '__LABELS__',
            fieldLabels(refusal.type, refusal.fields)
          );
    case 'unique':
      return '__LABELS__: this value is already taken in __RECORDS__.'
        .replace('__RECORDS__', recordPlural(refusal.type))
        .replace('__LABELS__', fieldLabels(refusal.type, refusal.fields));
    case 'exclusive':
      return '__LABELS__: this period is already taken in __RECORDS__.'
        .replace('__RECORDS__', recordPlural(refusal.type))
        .replace('__LABELS__', fieldLabels(refusal.type, refusal.partition));
    case 'capacity':
      return 'The limit of __LIMIT__ __RECORD__ entries is reached.'
        .replace('__RECORD__', recordName(refusal.type))
        .replace('__LIMIT__', String(refusal.limit));
    case 'recordGone':
      return 'This __RECORD__ no longer exists.'.replace('__RECORD__', recordName(refusal.type));
    case 'recordOwned':
      return 'This __RECORD__ belongs to someone else.'.replace(
        '__RECORD__',
        recordName(refusal.type)
      );
    case 'referenceGone':
      return 'The __LABEL__ this refers to no longer exists.'.replace(
        '__LABEL__',
        fieldLabel(refusal.type, refusal.field)
      );
    case 'orderLineGone':
      return 'An item in this order no longer exists.';
    case 'orderEmpty':
      return 'This order has no items yet.';
    case 'precondition':
      return 'This action cannot be carried out with the current values.';
  }
}

function genericMessage(kind: RequestKind): string {
  return kind === 'load' ? 'This could not be loaded.' : 'This could not be saved.';
}

function answersJson(response: Response): boolean {
  return (response.headers.get('content-type') ?? '').includes('application/json');
}

export async function apiRequestError(
  response: Response,
  kind: RequestKind
): Promise<ApiRequestError> {
  if (GATEWAY_STATUSES.has(response.status) && !answersJson(response)) {
    return new ApiRequestError('The server is not responding. Please try again.', null);
  }
  let data: { error?: string; code?: string; refusal?: Refusal };
  try {
    data = (await response.json()) as { error?: string; code?: string; refusal?: Refusal };
  } catch {
    data = {};
  }
  const known = data.code === undefined ? undefined : CODE_MESSAGES[data.code];
  if (known !== undefined) {
    return new ApiRequestError(known, null);
  }
  if (response.status === 403) {
    return new ApiRequestError(permissionDeniedMessage(data.error), null);
  }
  if (data.refusal === undefined) {
    return new ApiRequestError(genericMessage(kind), null);
  }
  return new ApiRequestError(refusalMessage(data.refusal), data.refusal);
}
