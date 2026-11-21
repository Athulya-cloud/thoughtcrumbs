// Small summaries that help you come back to the day: where you left off, and what the day held.

import { entriesOnDay } from './days.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "5 notes · 2 things · 1 session done", leaving out what's zero. */
export function daySummary(entries, dayStart) {
  const todays = entriesOnDay(entries, dayStart);
  const things = new Set(todays.map((e) => e.thingId).filter(Boolean));
  const sessions = todays.filter((e) => e.text.startsWith('✓')).length;
  // Focus Pill's "Started: …" lines mark a switch, not a thought, so they aren't counted as notes.
  const notes = todays.filter((e) => !e.text.startsWith('Started: ')).length;
  const parts = [];
  if (notes) parts.push(plural(notes, 'note'));
  if (things.size) parts.push(plural(things.size, 'thing'));
  if (sessions) parts.push(`${plural(sessions, 'session')} done`);
  return parts;
}

export const REENTRY_GAP = 45 * 60 * 1000;

/** The newest entry, when you've been away long enough to need a reminder. */
export function leftOffAt(entries, now = Date.now(), gap = REENTRY_GAP) {
  const newest = entries.reduce((best, e) => (!best || e.createdAt > best.createdAt ? e : best), null);
  if (!newest || now - newest.createdAt < gap) return null;
  return newest;
}

/** "50 min ago", "3 h ago", or null past a day (the caller then shows the date). */
export function hoursAgo(timestamp, now = Date.now()) {
  const minutes = Math.round((now - timestamp) / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : null;
}
