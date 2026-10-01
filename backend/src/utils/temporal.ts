// Generated with Lightscale AI. This file belongs to the owner of the generated application. See LICENSE.

import { Temporal } from '@js-temporal/polyfill';

export type TemporalKind = 'date' | 'time' | 'localdatetime' | 'datetime';

const TEMPORAL_SHAPES: Record<TemporalKind, RegExp> = {
  date: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
  time: /^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9]([.][0-9]{1,3})?)?$/,
  localdatetime:
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9]([.][0-9]{1,3})?)?$/,
  datetime:
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9]([.][0-9]{1,3})?)?(Z|[+-][0-9]{2}:[0-9]{2})$/,
};

function canonicalTemporal(kind: TemporalKind, value: string): string {
  if (!TEMPORAL_SHAPES[kind].test(value)) {
    throw new RangeError(`Invalid ${kind}: '${value}'`);
  }
  switch (kind) {
    case 'date':
      return Temporal.PlainDate.from(value).toString();
    case 'time':
      return Temporal.PlainTime.from(value).toString({ smallestUnit: 'millisecond' });
    case 'localdatetime':
      return Temporal.PlainDateTime.from(value).toString({ smallestUnit: 'millisecond' });
    case 'datetime':
      return Temporal.Instant.from(value).toString({ smallestUnit: 'millisecond' });
    default:
      throw new RangeError(`Unknown temporal kind: ${String(kind)}`);
  }
}

function namedZone(value: string): string {
  if (value === '' || value.startsWith('+') || value.startsWith('-')) {
    throw new RangeError('An IANA time zone is required');
  }
  return new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone;
}

export function localValue(value: string | null): string {
  return value === null || value === '' ? '' : canonicalTemporal('localdatetime', value);
}

export function temporalCall(name: string, args: ReadonlyArray<string | Date | null>): string {
  function argument(index: number): string {
    const value = args.at(index);
    if (value === null || value === undefined || value === '') {
      throw new RangeError(`${name} requires argument ${index + 1}`);
    }
    return value instanceof Date ? value.toISOString() : value;
  }
  const first = argument(0);
  switch (name) {
    case 'date':
    case 'time':
    case 'datetime':
      return canonicalTemporal(name, first);
    case 'localdatetime':
      return canonicalTemporal(
        'localdatetime',
        args.length === 1
          ? first
          : `${canonicalTemporal('date', first)}T${canonicalTemporal('time', argument(1))}`
      );
    case 'dateOf':
      return canonicalTemporal('localdatetime', first).slice(0, 10);
    case 'timeOf':
      return canonicalTemporal('time', canonicalTemporal('localdatetime', first).slice(11));
    case 'todayAt':
      return Temporal.Now.plainDateISO(namedZone(first)).toString();
    case 'toLocal':
      return Temporal.Instant.from(canonicalTemporal('datetime', first))
        .toZonedDateTimeISO(namedZone(argument(1)))
        .toPlainDateTime()
        .toString({ smallestUnit: 'millisecond' });
    case 'toInstant': {
      const resolution = args.length === 2 ? 'reject' : argument(2);
      if (resolution !== 'reject' && resolution !== 'earlier' && resolution !== 'later') {
        throw new RangeError('Unknown time resolution');
      }
      return Temporal.PlainDateTime.from(canonicalTemporal('localdatetime', first))
        .toZonedDateTime(namedZone(argument(1)), { disambiguation: resolution })
        .toInstant()
        .toString({ smallestUnit: 'millisecond' });
    }
    default:
      throw new RangeError(`Unknown temporal function: '${name}'`);
  }
}

export type DurationUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';

export interface IntervalValue {
  readonly start: string;
  readonly end: string;
}

export function intervalInterval(
  kind: TemporalKind,
  from: string | Date,
  to: string | Date
): IntervalValue {
  const start = canonicalTemporal(kind, from instanceof Date ? from.toISOString() : from);
  const end = canonicalTemporal(kind, to instanceof Date ? to.toISOString() : to);
  if (end < start) {
    throw new RangeError('An interval cannot end before it starts');
  }
  return { start, end };
}

export function presentInterval(value: IntervalValue | ''): IntervalValue {
  if (value === '') {
    throw new Error('An unset interval has no start or end');
  }
  return value;
}

export function isIntervalValue(kind: TemporalKind, value: unknown): value is IntervalValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (
    Object.keys(candidate).length !== 2 ||
    typeof candidate.start !== 'string' ||
    typeof candidate.end !== 'string'
  ) {
    return false;
  }
  try {
    intervalInterval(kind, candidate.start, candidate.end);
    return true;
  } catch (error) {
    if (error instanceof RangeError) {
      return false;
    }
    throw error;
  }
}

export function intervalUnion(
  kind: TemporalKind,
  values: readonly IntervalValue[]
): IntervalValue[] {
  const sorted = values
    .map((value) => intervalInterval(kind, value.start, value.end))
    .filter((value) => value.start < value.end);
  sorted.sort((left, right) => (left.start < right.start ? -1 : left.start > right.start ? 1 : 0));
  const result: IntervalValue[] = [];
  for (const value of sorted) {
    const last = result.at(-1);
    if (last === undefined || last.end < value.start) {
      result.push(value);
    } else if (last.end < value.end) {
      result[result.length - 1] = { start: last.start, end: value.end };
    }
  }
  return result;
}

export function intervalIntersect(
  kind: TemporalKind,
  left: readonly IntervalValue[],
  right: readonly IntervalValue[]
): IntervalValue[] {
  const first = intervalUnion(kind, left);
  const second = intervalUnion(kind, right);
  const result: IntervalValue[] = [];
  let i = 0;
  let j = 0;
  while (i < first.length && j < second.length) {
    const a = first[i];
    const b = second[j];
    const start = a.start > b.start ? a.start : b.start;
    const end = a.end < b.end ? a.end : b.end;
    if (start < end) {
      result.push({ start, end });
    }
    if (a.end <= b.end) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return result;
}

export function intervalSubtract(
  kind: TemporalKind,
  left: readonly IntervalValue[],
  right: readonly IntervalValue[]
): IntervalValue[] {
  const source = intervalUnion(kind, left);
  const exclusions = intervalUnion(kind, right);
  const result: IntervalValue[] = [];
  let index = 0;
  for (const value of source) {
    let { start } = value;
    while (index < exclusions.length && start < value.end) {
      const excluded = exclusions[index];
      if (excluded.end <= start) {
        index += 1;
      } else if (excluded.start >= value.end) {
        result.push({ start, end: value.end });
        start = value.end;
      } else {
        if (excluded.start > start) {
          result.push({ start, end: excluded.start });
        }
        start = excluded.end < value.end ? excluded.end : value.end;
        if (excluded.end <= value.end) {
          index += 1;
        }
      }
    }
    if (start < value.end) {
      result.push({ start, end: value.end });
    }
  }
  return result;
}

export interface Duration {
  readonly unit: DurationUnit;
  readonly count: number;
}

type TimeValue = string | Date | null;

const FIXED_UNIT_MILLISECONDS: Partial<Record<DurationUnit, number>> = {
  seconds: 1000,
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000,
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function dateValue(value: TimeValue): string {
  if (value === null) {
    return '';
  }
  if (value instanceof Date) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  return value.slice(0, 10);
}

export function datetimeValue(value: TimeValue): string {
  if (value === null) {
    return '';
  }
  return value instanceof Date ? value.toISOString() : value;
}

export function clockValue(value: string | null): string {
  if (value === null || value === '') {
    return '';
  }
  return canonicalTemporal('time', value);
}

export function temporalText(
  value: string,
  kind: 'date' | 'time' | 'localdatetime' | 'datetime'
): string {
  if (kind === 'time') {
    return value.replace(/[.]000$/, '').replace(/^([0-9]{2}:[0-9]{2}):00$/, '$1');
  }
  if (kind === 'localdatetime') {
    return value
      .replace('T', ' ')
      .replace(/[.]000$/, '')
      .replace(/([0-9]{2}:[0-9]{2}):00$/, '$1');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const day = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  return kind === 'date'
    ? day
    : `${day} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

export function makeDuration(unit: DurationUnit, count: number): Duration {
  return { unit, count };
}

function parseTime(time: string): Date {
  const parsed = new Date(
    /T[0-9:.]+$/.test(time) ? `${canonicalTemporal('localdatetime', time)}Z` : time
  );
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`'${time}' is not a date or datetime`);
  }
  return parsed;
}

function isDateOnly(time: string): boolean {
  return !time.includes('T');
}

function lastDayOfMonth(date: Date): number {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

function addMonths(date: Date, months: number): void {
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  date.setUTCDate(Math.min(day, lastDayOfMonth(date)));
}

function advance(date: Date, unit: DurationUnit, count: number): void {
  switch (unit) {
    case 'seconds':
      date.setUTCSeconds(date.getUTCSeconds() + count);
      return;
    case 'minutes':
      date.setUTCMinutes(date.getUTCMinutes() + count);
      return;
    case 'hours':
      date.setUTCHours(date.getUTCHours() + count);
      return;
    case 'days':
      date.setUTCDate(date.getUTCDate() + count);
      return;
    case 'weeks':
      date.setUTCDate(date.getUTCDate() + count * 7);
      return;
    case 'months':
      addMonths(date, count);
      return;
    case 'years':
      addMonths(date, count * 12);
      return;
    default: {
      const unreachable: never = unit;
      throw new Error(`Unhandled duration unit: ${String(unreachable)}`);
    }
  }
}

export function shiftTime(time: string, duration: Duration, sign: 1 | -1): string {
  const date = parseTime(time);
  advance(date, duration.unit, duration.count * sign);
  return isDateOnly(time)
    ? date.toISOString().slice(0, 10)
    : /T[0-9:.]+$/.test(time)
      ? date.toISOString().slice(0, -1)
      : date.toISOString();
}

function wholeCalendarUnits(unit: 'months' | 'years', from: Date, to: Date): number {
  const monthsPerStep = unit === 'years' ? 12 : 1;
  const monthSpan =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  let steps = Math.trunc(monthSpan / monthsPerStep);
  const advanced = new Date(from);
  advance(advanced, unit, steps);
  if (steps >= 0 && advanced.getTime() > to.getTime()) {
    steps -= 1;
  } else if (steps < 0 && advanced.getTime() < to.getTime()) {
    steps += 1;
  }
  return steps;
}

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d([.][0-9]{1,3})?)?$/;

function timeOfDayMilliseconds(value: string): number | null {
  if (!TIME_OF_DAY.test(value)) {
    return null;
  }
  const [hours = '0', minutes = '0', seconds = '0'] = value.split(':');
  return ((Number(hours) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000;
}

export function unitsBetween(unit: DurationUnit, from: string, to: string): number {
  const fromClock = timeOfDayMilliseconds(from);
  const toClock = timeOfDayMilliseconds(to);
  if (fromClock !== null && toClock !== null) {
    const unitSpan = FIXED_UNIT_MILLISECONDS[unit];
    if (unitSpan === undefined || unit === 'days' || unit === 'weeks') {
      throw new Error(
        `Cannot measure ${unit} between '${from}' and '${to}', which carry no date; seconds, minutes, and hours measure between two times of day`
      );
    }
    return Math.trunc((toClock - fromClock) / unitSpan);
  }
  const fromDate = parseTime(from);
  const toDate = parseTime(to);
  if (unit === 'months' || unit === 'years') {
    return wholeCalendarUnits(unit, fromDate, toDate);
  }
  const unitMilliseconds = FIXED_UNIT_MILLISECONDS[unit];
  if (unitMilliseconds === undefined) {
    throw new Error(`Unknown duration unit: ${unit}`);
  }
  return Math.trunc((toDate.getTime() - fromDate.getTime()) / unitMilliseconds);
}

function keptExtremum(left: string, right: string, keepLeft: boolean): string {
  if (left === '' || right === '') {
    return '';
  }
  return keepLeft ? left : right;
}

export function laterOf(left: string, right: string): string {
  return keptExtremum(left, right, left >= right);
}

export function earlierOf(left: string, right: string): string {
  return keptExtremum(left, right, left <= right);
}

function isWeekday(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

export function weekdaysBetween(from: string, to: string): number {
  const fromDate = parseTime(from);
  const toDate = parseTime(to);
  const cursor = new Date(
    Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate())
  );
  const end = new Date(
    Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate())
  );
  let count = 0;
  while (cursor.getTime() <= end.getTime()) {
    if (isWeekday(cursor)) {
      count += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

const WEEKDAY_NAMES = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

function weekdayIndex(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

function utcMidnight(value: string): Date {
  const parsed = parseTime(value);
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

export function dayOfWeekName(value: string): string {
  const name = WEEKDAY_NAMES.at(weekdayIndex(utcMidnight(value)));
  if (name === undefined) {
    throw new Error(`Cannot read the weekday of '${value}'`);
  }
  return name;
}

export function weekdayCountBetween(from: string, to: string, day: string): number {
  const target = (WEEKDAY_NAMES as readonly string[]).indexOf(day);
  if (target < 0) {
    throw new Error(`Cannot count '${day}' dates between '${from}' and '${to}', not a weekday`);
  }
  const start = utcMidnight(from);
  const end = utcMidnight(to);
  const totalDays = Math.floor((end.getTime() - start.getTime()) / DAY_MILLISECONDS) + 1;
  if (totalDays <= 0) {
    return 0;
  }
  const offset = (target - weekdayIndex(start) + 7) % 7;
  if (offset >= totalDays) {
    return 0;
  }
  return Math.floor((totalDays - 1 - offset) / 7) + 1;
}
