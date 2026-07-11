const DB_NAME = 'interstitial-journal';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

function addEntryToIDB(db, entry) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function getAllEntriesFromIDB(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      resolve(request.result.slice().sort((a, b) => b.createdAt - a.createdAt));
    };
    request.onerror = () => reject(request.error);
  });
}

function wrapIndexedDB(db) {
  return {
    isPersistent: true,
    addEntry: (entry) => addEntryToIDB(db, entry),
    getAllEntries: () => getAllEntriesFromIDB(db),
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
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(wrapIndexedDB(request.result));
    request.onerror = () => reject(request.error);
  });
}

function createMemoryStore() {
  const entries = [];
  return {
    isPersistent: false,
    addEntry(entry) {
      entries.push(entry);
      return Promise.resolve();
    },
    getAllEntries() {
      return Promise.resolve(entries.slice().sort((a, b) => b.createdAt - a.createdAt));
    },
  };
}

export async function openStore() {
  try {
    return await openIndexedDBStore();
  } catch (err) {
    return createMemoryStore();
  }
}
