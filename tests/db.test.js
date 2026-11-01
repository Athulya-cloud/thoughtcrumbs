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

describe('things', () => {
  it('stores, updates and lists things', async () => {
    const store = await openStore();
    await store.addThing({ id: 't1', title: 'Taxes', createdAt: 1, updatedAt: 1 });
    await store.updateThing({ id: 't1', title: 'Taxes', createdAt: 1, updatedAt: 9 });
    const things = await store.getAllThings();
    expect(things.find((t) => t.id === 't1').updatedAt).toBe(9);
  });

  it('updateEntry changes an existing entry instead of duplicating it', async () => {
    const store = await openStore();
    await store.addEntry({ id: 'e-move', text: 'x', createdAt: 5, thingId: null });
    await store.updateEntry({ id: 'e-move', text: 'x', createdAt: 5, thingId: 't1' });
    const matches = (await store.getAllEntries()).filter((e) => e.id === 'e-move');
    expect(matches).toEqual([{ id: 'e-move', text: 'x', createdAt: 5, thingId: 't1' }]);
  });
});

describe('deleteEntry', () => {
  it('removes just that entry', async () => {
    const store = await openStore();
    await store.addEntry({ id: 'del-1', text: 'a', createdAt: 7, thingId: null });
    await store.addEntry({ id: 'del-2', text: 'b', createdAt: 8, thingId: null });
    await store.deleteEntry('del-1');
    const ids = (await store.getAllEntries()).map((e) => e.id);
    expect(ids).toContain('del-2');
    expect(ids).not.toContain('del-1');
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
      await store.addThing({ id: 't', title: 'T', createdAt: 1, updatedAt: 1 });
      expect(await store.getAllThings()).toHaveLength(1);
    } finally {
      globalThis.indexedDB = original;
    }
  });
});
