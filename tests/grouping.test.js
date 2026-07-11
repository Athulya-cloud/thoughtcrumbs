import { describe, it, expect } from 'vitest';
import { groupByDay } from '../src/grouping.js';

describe('groupByDay', () => {
  // Fix "now" to local noon today (via the local Date constructor, not UTC,
  // so this test is stable regardless of the machine's timezone).
  const now = new Date(2026, 6, 11, 12, 0, 0).getTime();

  it('labels today\'s entries "Today"', () => {
    const entries = [{ id: 'a', text: 'x', createdAt: new Date(2026, 6, 11, 9, 0, 0).getTime() }];
    expect(groupByDay(entries, now)).toEqual([{ label: 'Today', entries }]);
  });

  it('labels yesterday\'s entries "Yesterday"', () => {
    const entries = [{ id: 'a', text: 'x', createdAt: new Date(2026, 6, 10, 9, 0, 0).getTime() }];
    expect(groupByDay(entries, now)).toEqual([{ label: 'Yesterday', entries }]);
  });

  it('groups multiple entries from the same day together, preserving order', () => {
    const entries = [
      { id: 'a', text: 'later', createdAt: new Date(2026, 6, 11, 15, 0, 0).getTime() },
      { id: 'b', text: 'earlier', createdAt: new Date(2026, 6, 11, 9, 0, 0).getTime() },
    ];
    expect(groupByDay(entries, now)).toEqual([{ label: 'Today', entries }]);
  });

  it('separates entries from different days into separate groups, in input order', () => {
    const todayEntry = { id: 'a', text: 'today', createdAt: new Date(2026, 6, 11, 9, 0, 0).getTime() };
    const yesterdayEntry = { id: 'b', text: 'yesterday', createdAt: new Date(2026, 6, 10, 9, 0, 0).getTime() };
    expect(groupByDay([todayEntry, yesterdayEntry], now)).toEqual([
      { label: 'Today', entries: [todayEntry] },
      { label: 'Yesterday', entries: [yesterdayEntry] },
    ]);
  });
});
