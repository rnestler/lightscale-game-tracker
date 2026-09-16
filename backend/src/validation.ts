const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_PATTERN = /^https?:\/\/.+\..+/;
const PHONE_PATTERN = /^\+?[\d\s\-().]{6,}$/;

function isBlankOrMatching(value: unknown, pattern: RegExp): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  return trimmed === '' || pattern.test(trimmed);
}

export function isEmailText(value: unknown): value is string {
  return isBlankOrMatching(value, EMAIL_PATTERN);
}

export function isUrlText(value: unknown): value is string {
  return isBlankOrMatching(value, URL_PATTERN);
}

export function isPhoneText(value: unknown): value is string {
  return isBlankOrMatching(value, PHONE_PATTERN);
}

const DATE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?)?$/;

function isCalendarDay(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function isDateText(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const match = DATE_PATTERN.exec(value);
  if (match === null) {
    return false;
  }
  const [, year, month, day, hours, minutes, seconds] = match.map(Number);
  return (
    isCalendarDay(year, month, day) &&
    (Number.isNaN(hours) || hours <= 23) &&
    (Number.isNaN(minutes) || minutes <= 59) &&
    (Number.isNaN(seconds) || seconds <= 59)
  );
}

export function isBlankOrDateText(value: unknown): value is string {
  return value === '' || isDateText(value);
}

export function isReferenceIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item !== '');
}

export function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
