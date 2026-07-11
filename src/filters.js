export function searchEntries(entries, query) {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) => e.text.toLowerCase().includes(q));
}

const RANGE_MS = {
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export function filterByDateRange(entries, range, now = Date.now()) {
  if (range === 'all') return entries;
  const cutoff = now - RANGE_MS[range];
  return entries.filter((e) => e.createdAt >= cutoff);
}
