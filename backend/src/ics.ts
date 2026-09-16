import { createHash } from 'node:crypto';
import { backendAddress } from './public-address.js';

export interface CalendarEvent {
  start: string;
  end: string;
  summary: string;
  location: string;
  description: string;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function asUtcStamp(value: string): string {
  const date = new Date(value);
  const day = `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
  const time = `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
  return `${day}T${time}Z`;
}

function asUtcDate(value: string): string {
  const date = new Date(value);
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

function isDateOnly(value: string): boolean {
  return !value.includes('T');
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n?/g, '\n')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function emitStart(label: 'DTSTART' | 'DTEND', value: string): string {
  return isDateOnly(value)
    ? `${label};VALUE=DATE:${asUtcDate(value)}`
    : `${label}:${asUtcStamp(value)}`;
}

function uid(notification: string, recipient: string, start: string): string {
  const hash = createHash('sha1').update(`${notification}|${recipient}|${start}`).digest('hex');
  return `${hash}@${backendAddress().hostname}`;
}

export function buildIcs(notification: string, recipient: string, event: CalendarEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lightscale AI//Email//EN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid(notification, recipient, event.start)}`,
    `DTSTAMP:${asUtcStamp(new Date().toISOString())}`,
    emitStart('DTSTART', event.start),
    `SUMMARY:${escapeText(event.summary)}`,
  ];
  if (event.end !== '') {
    lines.push(emitStart('DTEND', event.end));
  }
  if (event.location !== '') {
    lines.push(`LOCATION:${escapeText(event.location)}`);
  }
  if (event.description !== '') {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
