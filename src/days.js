// Day helpers for the daily-note view. All dates are local time.

const pad = (n) => String(n).padStart(2, '0');

export function startOfDay(timestamp) {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Calendar-safe across daylight-saving changes, unlike adding 86400000.
export function addDays(dayStart, count) {
  const d = new Date(dayStart);
  d.setDate(d.getDate() + count);
  return startOfDay(d.getTime());
}

export function dayKey(timestamp) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function clock(timestamp) {
  const d = new Date(timestamp);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function weekday(timestamp) {
  return new Date(timestamp).toLocaleDateString('en-GB', { weekday: 'long' }).toLowerCase();
}

// Entries written on the given day, oldest first, like a journal page.
export function entriesOnDay(entries, dayStart) {
  const end = addDays(dayStart, 1);
  return entries
    .filter((e) => e.createdAt >= dayStart && e.createdAt < end)
    .sort((a, b) => a.createdAt - b.createdAt);
}

// Entries grouped by day, oldest day first and oldest entry first within a day.
export function groupByDayAscending(entries) {
  const groups = new Map();
  for (const entry of entries.slice().sort((a, b) => a.createdAt - b.createdAt)) {
    const day = startOfDay(entry.createdAt);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(entry);
  }
  return [...groups].map(([day, list]) => ({ day, entries: list }));
}

export function daysWithEntries(entries) {
  return new Set(entries.map((e) => startOfDay(e.createdAt)));
}

// Six Monday-first weeks covering the month, as day-start timestamps.
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = startOfDay(new Date(year, month, 1 - offset).getTime());
  return Array.from({ length: 42 }, (_, i) => {
    const day = addDays(start, i);
    return { day, inMonth: new Date(day).getMonth() === month };
  });
}
