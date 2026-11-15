import { describe, it, expect } from 'vitest';
import {
  startOfDay, addDays, dayKey, clock, entriesOnDay, groupByDayAscending, daysWithEntries, monthGrid,
} from '../src/days.js';

const at = (y, m, d, h = 0, min = 0) => new Date(y, m, d, h, min).getTime();

describe('days', () => {
  it('formats a local date key and clock time', () => {
    expect(dayKey(at(2026, 10, 3, 9, 5))).toBe('2026-11-03');
    expect(clock(at(2026, 10, 3, 9, 5))).toBe('09:05');
  });

  it('steps by calendar days', () => {
    const day = startOfDay(at(2026, 10, 30, 15));
    expect(dayKey(addDays(day, 1))).toBe('2026-12-01');
    expect(dayKey(addDays(day, -30))).toBe('2026-10-31');
  });

  it('returns one day of entries, oldest first', () => {
    const entries = [
      { id: 'b', createdAt: at(2026, 10, 15, 13) },
      { id: 'x', createdAt: at(2026, 10, 14, 23, 59) },
      { id: 'a', createdAt: at(2026, 10, 15, 7) },
      { id: 'y', createdAt: at(2026, 10, 16, 0) },
    ];
    const day = startOfDay(at(2026, 10, 15));
    expect(entriesOnDay(entries, day).map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('groups entries by day in ascending order', () => {
    const entries = [
      { id: 'c', createdAt: at(2026, 10, 15, 9) },
      { id: 'a', createdAt: at(2026, 10, 13, 9) },
      { id: 'b', createdAt: at(2026, 10, 13, 8) },
    ];
    const groups = groupByDayAscending(entries);
    expect(groups.map((g) => dayKey(g.day))).toEqual(['2026-11-13', '2026-11-15']);
    expect(groups[0].entries.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('marks the days that have entries', () => {
    const marked = daysWithEntries([{ createdAt: at(2026, 10, 13, 9) }, { createdAt: at(2026, 10, 13, 18) }]);
    expect([...marked]).toEqual([startOfDay(at(2026, 10, 13))]);
  });

  it('builds a Monday-first six-week month grid', () => {
    const grid = monthGrid(2026, 10); // November 2026 starts on a Sunday
    expect(grid).toHaveLength(42);
    expect(dayKey(grid[0].day)).toBe('2026-10-26');
    expect(grid[0].inMonth).toBe(false);
    expect(dayKey(grid[6].day)).toBe('2026-11-01');
    expect(grid[6].inMonth).toBe(true);
    expect(grid.filter((c) => c.inMonth)).toHaveLength(30);
  });
});
