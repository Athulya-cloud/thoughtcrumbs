const DB_NAME = 'interstitial-journal';
const DB_VERSION = 2;
const ENTRIES = 'entries';
const THINGS = 'things';

function putInIDB(db, storeName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function deleteFromIDB(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function getAllFromIDB(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const newestFirst = (list) => list.slice().sort((a, b) => b.createdAt - a.createdAt);

function wrapIndexedDB(db) {
  return {
    isPersistent: true,
    addEntry: (entry) => putInIDB(db, ENTRIES, entry),
    updateEntry: (entry) => putInIDB(db, ENTRIES, entry),
    deleteEntry: (id) => deleteFromIDB(db, ENTRIES, id),
    getAllEntries: async () => newestFirst(await getAllFromIDB(db, ENTRIES)),
    addThing: (thing) => putInIDB(db, THINGS, thing),
    updateThing: (thing) => putInIDB(db, THINGS, thing),
    getAllThings: () => getAllFromIDB(db, THINGS),
  };
}

function openIndexedDBStore() {
  return new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(err);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ENTRIES)) {
        const store = db.createObjectStore(ENTRIES, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains(THINGS)) {
        db.createObjectStore(THINGS, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(wrapIndexedDB(request.result));
    request.onerror = () => reject(request.error);
  });
}

function createMemoryStore() {
  const entries = new Map();
  const things = new Map();
  const put = (map) => (value) => {
    map.set(value.id, value);
    return Promise.resolve();
  };
  return {
    isPersistent: false,
    addEntry: put(entries),
    updateEntry: put(entries),
    deleteEntry: (id) => {
      entries.delete(id);
      return Promise.resolve();
    },
    getAllEntries: () => Promise.resolve(newestFirst([...entries.values()])),
    addThing: put(things),
    updateThing: put(things),
    getAllThings: () => Promise.resolve([...things.values()]),
  };
}

export async function openStore() {
  try {
    return await openIndexedDBStore();
  } catch (err) {
    return createMemoryStore();
  }
}
