import { describe, it, expect } from 'vitest';
import { daySummary, leftOffAt, hoursAgo, REENTRY_GAP } from '../src/recap.js';
import { buildExport, exportFileName } from '../src/export.js';

const day = new Date(2026, 10, 21).getTime();
const at = (h, m = 0) => new Date(2026, 10, 21, h, m).getTime();

describe('daySummary', () => {
  it('counts notes, things and finished sessions', () => {
    const entries = [
      { id: '1', text: 'Started: jog', createdAt: at(9), thingId: null },
      { id: '2', text: '✓ jog (25 min)', createdAt: at(10), thingId: null },
      { id: '3', text: 'flour', createdAt: at(11), thingId: 't1' },
      { id: '4', text: 'other day', createdAt: at(11) + 86400000, thingId: 't2' },
    ];
    expect(daySummary(entries, day)).toEqual(['2 notes', '1 thing', '1 session done']);
  });

  it('is empty for a blank day', () => {
    expect(daySummary([], day)).toEqual([]);
  });
});

describe('leftOffAt', () => {
  const entries = [{ id: 'a', createdAt: at(9) }, { id: 'b', createdAt: at(12) }];

  it('returns the newest entry after a long gap', () => {
    expect(leftOffAt(entries, at(14)).id).toBe('b');
  });

  it('stays quiet right after writing', () => {
    expect(leftOffAt(entries, at(12) + REENTRY_GAP - 1)).toBeNull();
    expect(leftOffAt([], at(14))).toBeNull();
  });
});

describe('hoursAgo', () => {
  it('speaks in minutes, then hours', () => {
    expect(hoursAgo(at(12), at(12, 50))).toBe('50 min ago');
    expect(hoursAgo(at(9), at(12))).toBe('3 h ago');
    expect(hoursAgo(at(9), at(9) + 2 * 86400000)).toBeNull();
  });
});

describe('export', () => {
  it('packs things and entries oldest first', () => {
    const data = buildExport([{ id: 't', createdAt: 2 }, { id: 's', createdAt: 1 }], [{ id: 'e', createdAt: 5 }], at(9));
    expect(data.things.map((t) => t.id)).toEqual(['s', 't']);
    expect(data.entries).toHaveLength(1);
    expect(data.version).toBe(1);
    expect(exportFileName(at(9))).toBe('thoughtcrumbs-2026-11-21.json');
  });
});
