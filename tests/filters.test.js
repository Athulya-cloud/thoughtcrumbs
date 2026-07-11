import { describe, it, expect } from 'vitest';
import { searchEntries, filterByDateRange } from '../src/filters.js';

const entries = [
  { id: 'a', text: 'Lost the thread mid-meeting', createdAt: 1000 },
  { id: 'b', text: 'Finally in flow on the report', createdAt: 2000 },
];

describe('searchEntries', () => {
  it('returns all entries when query is empty', () => {
    expect(searchEntries(entries, '')).toEqual(entries);
  });

  it('filters case-insensitively by substring', () => {
    expect(searchEntries(entries, 'FLOW')).toEqual([entries[1]]);
  });

  it('returns empty array when nothing matches', () => {
    expect(searchEntries(entries, 'xyz')).toEqual([]);
  });
});

describe('filterByDateRange', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = 100 * DAY;
  const withinWeek = { id: 'w', text: 'recent', createdAt: now - 3 * DAY };
  const withinMonth = { id: 'm', text: 'a bit old', createdAt: now - 20 * DAY };
  const veryOld = { id: 'o', text: 'ancient', createdAt: now - 90 * DAY };
  const all = [withinWeek, withinMonth, veryOld];

  it('returns everything for "all"', () => {
    expect(filterByDateRange(all, 'all', now)).toEqual(all);
  });

  it('returns only entries within 7 days for "7d"', () => {
    expect(filterByDateRange(all, '7d', now)).toEqual([withinWeek]);
  });

  it('returns entries within 30 days for "30d"', () => {
    expect(filterByDateRange(all, '30d', now)).toEqual([withinWeek, withinMonth]);
  });
});
