export function buildThing(title, now) {
  const trimmed = title.trim();
  if (!trimmed) return null;
  return { id: crypto.randomUUID(), title: trimmed, createdAt: now, updatedAt: now };
}

export function sortThings(things) {
  return things.slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function entriesForThing(entries, thingId) {
  return entries.filter((e) => e.thingId === thingId);
}

// Thoughts dumped without a topic (thingId === null). Entries from before
// topics existed have no thingId at all and stay in Review only.
export function inboxEntries(entries) {
  return entries.filter((e) => e.thingId === null);
}

export function lastNoteAt(entries, thing) {
  const times = entriesForThing(entries, thing.id).map((e) => e.createdAt);
  return times.length ? Math.max(...times) : thing.createdAt;
}

function startOfDay(timestamp) {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function relativeDay(timestamp, now = Date.now()) {
  const days = Math.round((startOfDay(now) - startOfDay(timestamp)) / 86400000);
  const plural = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return plural(days, 'day');
  if (days < 30) return plural(Math.floor(days / 7), 'week');
  if (days < 365) return plural(Math.floor(days / 30), 'month');
  return plural(Math.floor(days / 365), 'year');
}

export function matchThings(things, query) {
  const q = query.trim().toLowerCase();
  const sorted = sortThings(things);
  if (!q) return sorted;
  return sorted.filter((t) => t.title.toLowerCase().includes(q));
}

export const HOME_CAP = 7;
export const SWEEP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

// Things without a status (made before Park/Done existed) are active.
export function statusOf(thing) {
  return thing.status || 'active';
}

export function visibleThings(sortedActive, showAll, cap = HOME_CAP) {
  if (showAll || sortedActive.length <= cap) return { shown: sortedActive, hiddenCount: 0 };
  return { shown: sortedActive.slice(0, cap), hiddenCount: sortedActive.length - cap };
}

export function needsSweep(lastSweepAt, now, activeCount) {
  return activeCount > 0 && now - lastSweepAt >= SWEEP_INTERVAL_MS;
}

// The things untouched the longest, a few at a time so a check never feels like a chore.
export function pickSweep(activeThings, entries, count = 3) {
  return activeThings
    .slice()
    .sort((a, b) => lastNoteAt(entries, a) - lastNoteAt(entries, b))
    .slice(0, count);
}
