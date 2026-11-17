import { describe, it, expect } from 'vitest';
import { readPillHash, importPillEntries, localSeenIds } from '../src/pill-import.js';

const encode = (value) => '#pill=' + Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

function memoryStore(initial = []) {
  const entries = new Map(initial.map((e) => [e.id, e]));
  return {
    addEntry: async (e) => { entries.set(e.id, e); },
    getAllEntries: async () => [...entries.values()],
    entries,
  };
}

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
}

describe('readPillHash', () => {
  it('returns null for other fragments', () => {
    expect(readPillHash('')).toBeNull();
    expect(readPillHash('#day=2026-11-18')).toBeNull();
  });

  it('decodes entries, including non-ASCII text', () => {
    const list = readPillHash(encode([{ id: 'pill-1', text: ' ✓ Draft X post: 3 hooks  ', createdAt: 1000 }]));
    expect(list).toEqual([{ id: 'pill-1', text: '✓ Draft X post: 3 hooks', createdAt: 1000, thingId: null }]);
  });

  it('drops invalid entries and survives garbage', () => {
    const list = readPillHash(encode([
      { id: 'pill-ok', text: 'fine', createdAt: 5 },
      { id: 'not-pill', text: 'bad id', createdAt: 5 },
      { id: 'pill-2', text: '   ', createdAt: 5 },
      { id: 'pill-3', text: 'no time' },
    ]));
    expect(list.map((e) => e.id)).toEqual(['pill-ok']);
    expect(readPillHash('#pill=%%%not-base64')).toEqual([]);
    expect(readPillHash(encode({ not: 'a list' }))).toEqual([]);
  });
});

describe('importPillEntries', () => {
  it('adds new entries once, even when the same link is opened twice', async () => {
    const store = memoryStore();
    const storage = memoryStorage();
    const entries = readPillHash(encode([
      { id: 'pill-a', text: 'one', createdAt: 1 },
      { id: 'pill-b', text: 'two', createdAt: 2 },
    ]));
    expect(await importPillEntries(store, entries, localSeenIds(storage))).toBe(2);
    expect(await importPillEntries(store, entries, localSeenIds(storage))).toBe(0);
    expect(store.entries.size).toBe(2);
  });

  it('does not bring back an entry the user deleted', async () => {
    const store = memoryStore();
    const storage = memoryStorage();
    const entries = readPillHash(encode([{ id: 'pill-a', text: 'one', createdAt: 1 }]));
    await importPillEntries(store, entries, localSeenIds(storage));
    store.entries.delete('pill-a');
    expect(await importPillEntries(store, entries, localSeenIds(storage))).toBe(0);
    expect(store.entries.size).toBe(0);
  });

  it('never overwrites an entry that already exists', async () => {
    const store = memoryStore([{ id: 'pill-a', text: 'edited here', createdAt: 1, thingId: 't1' }]);
    const entries = readPillHash(encode([{ id: 'pill-a', text: 'original', createdAt: 1 }]));
    expect(await importPillEntries(store, entries, localSeenIds(memoryStorage()))).toBe(0);
    expect(store.entries.get('pill-a').text).toBe('edited here');
  });
});
