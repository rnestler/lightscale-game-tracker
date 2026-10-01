const EMAIL_PATTERN = /^[^\s@,;:<>()[\]"\\]+@[^\s@,;:<>()[\]"\\]+\.[^\s@,;:<>()[\]"\\]+$/;

export function isEmailAddress(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_PATTERN.test(value.trim());
}

const DATE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?)?$/;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.[0-9]{1,3})?)?$/;

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

export function isTimeText(value: unknown): value is string {
  return typeof value === 'string' && TIME_PATTERN.test(value);
}

export function isBlankOrTimeText(value: unknown): value is string {
  return value === '' || isTimeText(value);
}

export function isLocalDateTimeText(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]{1,3})?)?$/.test(
      value
    ) &&
    isDateText(value)
  );
}

export function isReferenceIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item !== '');
}

export function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
