// Notes from Focus Pill arrive in the link's fragment: #pill=<base64url JSON>.
// The fragment never leaves the browser, so notes are not sent to the web server.

const PREFIX = '#pill=';
const MAX_ENTRIES = 500;
const MAX_TEXT = 2000;
const ID_PATTERN = /^pill-[A-Za-z0-9-]{1,64}$/;
const SEEN_KEY = 'thoughtcrumbs-pill-imported';
const SEEN_LIMIT = 5000;

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function isValid(entry) {
  return entry
    && typeof entry.id === 'string' && ID_PATTERN.test(entry.id)
    && typeof entry.text === 'string' && entry.text.trim() && entry.text.length <= MAX_TEXT
    && Number.isFinite(entry.createdAt) && entry.createdAt > 0;
}

/** Returns the valid entries in a `#pill=` fragment, or null when the fragment isn't one. */
export function readPillHash(hash) {
  if (typeof hash !== 'string' || !hash.startsWith(PREFIX)) return null;
  try {
    const list = JSON.parse(decodeBase64Url(hash.slice(PREFIX.length)));
    if (!Array.isArray(list)) return [];
    return list.slice(0, MAX_ENTRIES).filter(isValid).map((entry) => ({
      id: entry.id,
      text: entry.text.trim(),
      createdAt: entry.createdAt,
      thingId: null,
    }));
  } catch {
    return [];
  }
}

/** Remembers which Focus Pill notes were already imported, so deleting one here keeps it deleted. */
export function localSeenIds(storage = globalThis.localStorage) {
  let ids = [];
  try { ids = JSON.parse(storage.getItem(SEEN_KEY) || '[]'); } catch { ids = []; }
  const seen = new Set(Array.isArray(ids) ? ids : []);
  return {
    has: (id) => seen.has(id),
    add: (id) => seen.add(id),
    save: () => {
      try { storage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-SEEN_LIMIT))); } catch { /* storage unavailable */ }
    },
  };
}

/** Adds entries that aren't stored or imported yet. Returns how many were added. */
export async function importPillEntries(store, entries, seen) {
  const existing = new Set((await store.getAllEntries()).map((entry) => entry.id));
  let added = 0;
  for (const entry of entries) {
    if (existing.has(entry.id) || seen.has(entry.id)) continue;
    await store.addEntry(entry);
    seen.add(entry.id);
    existing.add(entry.id);
    added += 1;
  }
  seen.save();
  return added;
}
