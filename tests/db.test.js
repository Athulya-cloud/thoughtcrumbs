import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openStore } from '../src/db.js';

describe('openStore (IndexedDB available)', () => {
  it('reports persistent storage', async () => {
    const store = await openStore();
    expect(store.isPersistent).toBe(true);
  });

  it('returns an empty array when no entries exist yet', async () => {
    const store = await openStore();
    const entries = await store.getAllEntries();
    expect(entries).toEqual([]);
  });

  it('stores and retrieves an entry', async () => {
    const store = await openStore();
    await store.addEntry({ id: 'entry-1', text: 'hello', createdAt: 1000 });
    const entries = await store.getAllEntries();
    expect(entries).toEqual([{ id: 'entry-1', text: 'hello', createdAt: 1000 }]);
  });

  it('returns entries sorted newest first', async () => {
    const store = await openStore();
    await store.addEntry({ id: 'entry-2', text: 'first', createdAt: 2000 });
    await store.addEntry({ id: 'entry-3', text: 'second', createdAt: 3000 });
    const entries = await store.getAllEntries();
    const ids = entries.map((e) => e.id).filter((id) => id === 'entry-2' || id === 'entry-3');
    expect(ids).toEqual(['entry-3', 'entry-2']);
  });
});

describe('openStore (IndexedDB unavailable)', () => {
  it('falls back to a non-persistent in-memory store', async () => {
    const original = globalThis.indexedDB;
    globalThis.indexedDB = undefined;
    try {
      const store = await openStore();
      expect(store.isPersistent).toBe(false);
      await store.addEntry({ id: 'a', text: 'hello', createdAt: 1000 });
      const entries = await store.getAllEntries();
      expect(entries).toEqual([{ id: 'a', text: 'hello', createdAt: 1000 }]);
    } finally {
      globalThis.indexedDB = original;
    }
  });
});
