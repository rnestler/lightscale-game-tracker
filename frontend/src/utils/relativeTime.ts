import { i18n } from '../i18n/text';
const UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

function formatter(): Intl.RelativeTimeFormat {
  return new Intl.RelativeTimeFormat(i18n.locale, { numeric: 'auto' });
}

export function relativeTime(value: string | Date): string {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return formatter().format(Math.round(seconds / size), unit);
    }
  }
  return formatter().format(0, 'second');
}

const DAY_UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365],
  ['month', 30],
  ['week', 7],
];

function startOfDay(moment: Date): number {
  return new Date(moment.getFullYear(), moment.getMonth(), moment.getDate()).getTime();
}

export function addDays(day: string, offset: number): string {
  const shifted = new Date(`${day}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offset);
  return shifted.toISOString().slice(0, 10);
}

export function relativeDay(value: string): string {
  const days = Math.round(
    (startOfDay(new Date(`${value}T00:00:00`)) - startOfDay(new Date())) / 86400000
  );
  for (const [unit, size] of DAY_UNITS) {
    if (Math.abs(days) >= size) {
      return formatter().format(Math.round(days / size), unit);
    }
  }
  return formatter().format(days, 'day');
}
