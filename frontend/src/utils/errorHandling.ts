import { i18n } from '../i18n/text';
import { toast } from './toast';
import { fieldLabel, fieldLabels, recordName, recordPlural } from './recordNames';

export type RequestKind = 'load' | 'save';

const GATEWAY_STATUSES = new Set([502, 503, 504]);

export function getErrorMessage(error: unknown, defaultMessage = i18n.chrome.unknownError): string {
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

const CODE_MESSAGES: Partial<Record<string, () => string>> = {
  AUTHENTICATION_REQUIRED: (): string => i18n.chrome.errorSessionEnded,
  UNAUTHORIZED: (): string => i18n.chrome.errorUnauthorized,
  ADMIN_REQUIRED: (): string => i18n.chrome.errorAdminRequired,
  APP_ACCESS_REQUIRED: (): string => i18n.chrome.errorAppAccessRequired,
  ROLE_NAME_MISSING: (): string => i18n.chrome.errorRoleNameMissing,
  ROLE_NOT_FOUND: (): string => i18n.chrome.errorRoleNotFound,
  ROLE_ASSIGNMENT_NOT_FOUND: (): string => i18n.chrome.errorRoleAssignmentNotFound,
  CANNOT_REMOVE_OWN_ADMIN_ROLE: (): string => i18n.chrome.errorCannotRemoveOwnAdminRole,
  CANNOT_DELETE_SELF: (): string => i18n.chrome.errorCannotDeleteSelf,
  REFERENCE_CONFLICT: (): string => i18n.chrome.errorRecordStillReferenced,
  MIRRORED_COLLECTION: (): string => i18n.chrome.errorMirroredCollection,
  AI_NOT_CONFIGURED: (): string => i18n.chrome.errorAiNotConfigured,
  DERIVED_SORT_LIMIT: (): string => i18n.chrome.errorDerivedSortLimit,
  EMAIL_REQUIRED: (): string => i18n.chrome.invalidEmail,
  USER_ALREADY_EXISTS: (): string => i18n.chrome.authUserExists,
  INVITATION_EXISTS: (): string => i18n.chrome.invitationExists,
  INVITATION_NOT_FOUND: (): string => i18n.chrome.invitationNotFound,
  ACCOUNT_DELETION_DISABLED: (): string => i18n.chrome.accountDeletionDisabled,
  ADMIN_CANNOT_DELETE_ACCOUNT: (): string => i18n.chrome.adminCannotDeleteAccount,
  SUBMISSION_REJECTED: (): string => i18n.chrome.submissionRejected,
  RECENT_SIGN_IN_REQUIRED: (): string => i18n.chrome.deleteAccountSignInAgain,
};

export async function apiErrorMessage(response: Response, fallback: string): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as { code?: string };
  const known = data.code === undefined ? undefined : CODE_MESSAGES[data.code]?.();
  return known ?? fallback;
}

const AUTH_CODE_MESSAGES: Partial<Record<string, () => string>> = {
  INVALID_EMAIL_OR_PASSWORD: (): string => i18n.chrome.authInvalidCredentials,
  INVALID_PASSWORD: (): string => i18n.chrome.invalidPassword,
  INVALID_EMAIL: (): string => i18n.chrome.invalidEmail,
  USER_ALREADY_EXISTS: (): string => i18n.chrome.authUserExists,
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: (): string => i18n.chrome.authUserExists,
  PASSWORD_TOO_SHORT: (): string => i18n.chrome.authPasswordTooShort,
  PASSWORD_TOO_LONG: (): string => i18n.chrome.authPasswordTooLong,
  CREDENTIAL_ACCOUNT_NOT_FOUND: (): string => i18n.chrome.authNoPasswordAccount,
  INVALID_TOKEN: (): string => i18n.chrome.authLinkExpired,
  TOKEN_EXPIRED: (): string => i18n.chrome.authLinkExpired,
  SESSION_EXPIRED: (): string => i18n.chrome.errorSessionEnded,
  INVALID_CODE: (): string => i18n.chrome.invalidVerificationCode,
  INVALID_BACKUP_CODE: (): string => i18n.chrome.invalidVerificationCode,
  OTP_HAS_EXPIRED: (): string => i18n.chrome.authCodeExpired,
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: (): string => i18n.chrome.authTooManyAttempts,
  ACCOUNT_TEMPORARILY_LOCKED: (): string => i18n.chrome.authTooManyAttempts,
  PASSKEY_NOT_FOUND: (): string => i18n.chrome.noPasskeyFound,
  AUTHENTICATION_FAILED: (): string => i18n.chrome.passkeyFailed,
  PREVIOUSLY_REGISTERED: (): string => i18n.chrome.passkeyAlreadyRegistered,
  SIGNUP_INVITATION_REQUIRED: (): string => i18n.chrome.invitationOnlyNotice,
};

export interface AuthFailure {
  code?: string;
  status?: number;
  message?: string;
}

export function authErrorMessage(failure: AuthFailure, fallback: string): string {
  const known = failure.code === undefined ? undefined : AUTH_CODE_MESSAGES[failure.code]?.();
  if (known !== undefined) {
    return known;
  }
  return failure.status === 429 ? i18n.chrome.authTooManyAttempts : fallback;
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
    return i18n.chrome.errorPermissionDenied;
  }
  const resource = match[2];
  return i18n.fill(i18n.chrome.errorPermissionDeniedOn, { resource });
}

type StringFormat = 'email' | 'phone' | 'url' | 'country' | 'timezone';

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
  | { kind: 'localTime'; local: string; zone: string; reason: 'ambiguous' | 'nonexistent' }
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
    case 'localTime':
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
      return i18n.chrome.invalidEmail;
    case 'phone':
      return i18n.chrome.invalidPhone;
    case 'url':
      return i18n.chrome.invalidUrl;
    case 'country':
      return i18n.chrome.invalidCountry;
    case 'timezone':
      return i18n.chrome.invalidTimezone;
  }
}

function refusalMessage(refusal: Refusal): string {
  switch (refusal.kind) {
    case 'stated':
      return refusal.message;
    case 'frozen':
      return i18n.fill(i18n.chrome.refusalFrozen, { record: recordName(refusal.type) });
    case 'format':
      return formatMessage(refusal.format);
    case 'required':
      return i18n.fill(i18n.chrome.fieldRequired, {
        label: fieldLabel(refusal.type, refusal.field),
      });
    case 'rule':
      return refusal.fields.length === 1
        ? i18n.fill(i18n.chrome.refusalRule, { labels: fieldLabels(refusal.type, refusal.fields) })
        : i18n.fill(i18n.chrome.refusalRuleCombined, {
            labels: fieldLabels(refusal.type, refusal.fields),
          });
    case 'unique':
      return i18n.fill(i18n.chrome.refusalUnique, {
        records: recordPlural(refusal.type),
        labels: fieldLabels(refusal.type, refusal.fields),
      });
    case 'exclusive':
      return i18n.fill(i18n.chrome.refusalExclusive, {
        records: recordPlural(refusal.type),
        labels: fieldLabels(refusal.type, refusal.partition),
      });
    case 'capacity':
      return i18n.fill(i18n.chrome.refusalCapacity, {
        record: recordName(refusal.type),
        limit: String(refusal.limit),
      });
    case 'recordGone':
      return i18n.fill(i18n.chrome.refusalRecordGone, { record: recordName(refusal.type) });
    case 'recordOwned':
      return i18n.fill(i18n.chrome.refusalRecordOwned, { record: recordName(refusal.type) });
    case 'referenceGone':
      return i18n.fill(i18n.chrome.refusalReferenceGone, {
        label: fieldLabel(refusal.type, refusal.field),
      });
    case 'orderLineGone':
      return i18n.chrome.refusalOrderLineGone;
    case 'orderEmpty':
      return i18n.chrome.refusalOrderEmpty;
    case 'precondition':
      return i18n.chrome.refusalPrecondition;
    case 'localTime':
      return i18n.fill(
        refusal.reason === 'ambiguous'
          ? i18n.chrome.ambiguousLocalTime
          : i18n.chrome.nonexistentLocalTime,
        { time: refusal.local.replace('T', ' '), zone: refusal.zone }
      );
  }
}

function genericMessage(kind: RequestKind): string {
  return kind === 'load' ? i18n.chrome.loadFailedGeneric : i18n.chrome.refusalGeneric;
}

function answersJson(response: Response): boolean {
  return (response.headers.get('content-type') ?? '').includes('application/json');
}

export async function apiRequestError(
  response: Response,
  kind: RequestKind
): Promise<ApiRequestError> {
  if (GATEWAY_STATUSES.has(response.status) && !answersJson(response)) {
    return new ApiRequestError(i18n.chrome.serverUnreachable, null);
  }
  let data: { error?: string; code?: string; refusal?: Refusal };
  try {
    data = (await response.json()) as { error?: string; code?: string; refusal?: Refusal };
  } catch {
    data = {};
  }
  const known = data.code === undefined ? undefined : CODE_MESSAGES[data.code]?.();
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
