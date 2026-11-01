import { describe, it, expect } from 'vitest';
import { buildThing, sortThings, entriesForThing, inboxEntries, lastNoteAt, relativeDay, matchThings } from '../src/things.js';

describe('buildThing', () => {
  it('returns null for empty or whitespace titles', () => {
    expect(buildThing('', 1)).toBeNull();
    expect(buildThing('   ', 1)).toBeNull();
  });
  it('trims the title and sets both timestamps', () => {
    const t = buildThing('  Taxes ', 5);
    expect(t.title).toBe('Taxes');
    expect(t.createdAt).toBe(5);
    expect(t.updatedAt).toBe(5);
    expect(t.id.length).toBeGreaterThan(0);
  });
});

describe('sortThings', () => {
  it('puts the most recently touched thing first without mutating', () => {
    const list = [{ id: 'a', updatedAt: 1 }, { id: 'b', updatedAt: 3 }, { id: 'c', updatedAt: 2 }];
    expect(sortThings(list).map((t) => t.id)).toEqual(['b', 'c', 'a']);
    expect(list.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('entry filters', () => {
  const entries = [
    { id: '1', thingId: 'x' },
    { id: '2', thingId: null },
    { id: '3' },
    { id: '4', thingId: 'x' },
  ];
  it('returns only entries for the thing', () => {
    expect(entriesForThing(entries, 'x').map((e) => e.id)).toEqual(['1', '4']);
  });
});

describe('matchThings', () => {
  const things = [
    { id: 'a', title: 'Taxes', updatedAt: 1 },
    { id: 'b', title: 'Trip planning', updatedAt: 2 },
  ];
  it('returns everything, newest first, for an empty query', () => {
    expect(matchThings(things, '').map((t) => t.id)).toEqual(['b', 'a']);
  });
  it('matches case-insensitively', () => {
    expect(matchThings(things, 'TAX').map((t) => t.id)).toEqual(['a']);
  });
});

describe('inboxEntries', () => {
  it('means thingId null, not older entries that have no thingId', () => {
    const entries = [{ id: '1', thingId: 'x' }, { id: '2', thingId: null }, { id: '3' }];
    expect(inboxEntries(entries).map((e) => e.id)).toEqual(['2']);
  });
});

describe('lastNoteAt', () => {
  const thing = { id: 'x', createdAt: 10 };
  it('is the newest entry in the thing', () => {
    const entries = [{ thingId: 'x', createdAt: 50 }, { thingId: 'x', createdAt: 90 }, { thingId: 'y', createdAt: 999 }];
    expect(lastNoteAt(entries, thing)).toBe(90);
  });
  it('falls back to when the thing was made', () => {
    expect(lastNoteAt([], thing)).toBe(10);
  });
});

describe('relativeDay', () => {
  const now = new Date(2026, 9, 31, 15, 0).getTime();
  const daysAgo = (n) => new Date(2026, 9, 31 - n, 9, 0).getTime();
  it('words recent days plainly', () => {
    expect(relativeDay(daysAgo(0), now)).toBe('today');
    expect(relativeDay(daysAgo(1), now)).toBe('yesterday');
    expect(relativeDay(daysAgo(4), now)).toBe('4 days ago');
  });
  it('switches to weeks, months and years', () => {
    expect(relativeDay(daysAgo(7), now)).toBe('1 week ago');
    expect(relativeDay(daysAgo(21), now)).toBe('3 weeks ago');
    expect(relativeDay(daysAgo(65), now)).toBe('2 months ago');
    expect(relativeDay(daysAgo(800), now)).toBe('2 years ago');
  });
});

import { statusOf, visibleThings, needsSweep, pickSweep, SWEEP_INTERVAL_MS } from '../src/things.js';

describe('statusOf', () => {
  it('treats things without a status as active', () => {
    expect(statusOf({ id: 'a' })).toBe('active');
    expect(statusOf({ id: 'a', status: 'parked' })).toBe('parked');
  });
});

describe('visibleThings', () => {
  const ten = Array.from({ length: 10 }, (_, i) => ({ id: String(i) }));
  it('shows everything when there are 7 or fewer', () => {
    expect(visibleThings(ten.slice(0, 7), false).hiddenCount).toBe(0);
  });
  it('caps at 7 and counts the rest', () => {
    const v = visibleThings(ten, false);
    expect(v.shown).toHaveLength(7);
    expect(v.hiddenCount).toBe(3);
  });
  it('shows all when asked', () => {
    expect(visibleThings(ten, true).shown).toHaveLength(10);
  });
});

describe('needsSweep', () => {
  const now = 10 * SWEEP_INTERVAL_MS;
  it('is due after a week with active things', () => {
    expect(needsSweep(now - SWEEP_INTERVAL_MS, now, 3)).toBe(true);
    expect(needsSweep(now - SWEEP_INTERVAL_MS + 1, now, 3)).toBe(false);
  });
  it('never asks when there is nothing active', () => {
    expect(needsSweep(0, now, 0)).toBe(false);
  });
});

describe('pickSweep', () => {
  it('picks the longest-untouched things, at most three', () => {
    const things = [{ id: 'a', createdAt: 40 }, { id: 'b', createdAt: 10 }, { id: 'c', createdAt: 30 }, { id: 'd', createdAt: 20 }];
    expect(pickSweep(things, []).map((t) => t.id)).toEqual(['b', 'd', 'c']);
  });
});
