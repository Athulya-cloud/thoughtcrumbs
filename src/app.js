import { openStore } from './db.js';
import { initReviewView } from './review.js';
import { initThingsView } from './things-view.js';
import { initPicker } from './picker.js';
import { shouldNudge } from './nudge.js';
import {
  readPillHash, importPillEntries, localSeenIds, fetchPillOutbox, isPillLinked, markPillLinked, endsASession,
} from './pill-import.js';
import { buildExport, exportFileName } from './export.js';

const NUDGE_KEY = 'thoughtcrumbs-nudge';

function readNudgeSetting() {
  try { return localStorage.getItem(NUDGE_KEY) === 'on'; } catch { return false; }
}

function writeNudgeSetting(on) {
  try { localStorage.setItem(NUDGE_KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
}

async function main() {
  const store = await openStore();

  if (!store.isPersistent) {
    document.querySelector('#persistence-warning').hidden = false;
  }

  const views = {
    things: { el: document.querySelector('#things-view'), nav: document.querySelector('#nav-things') },
    review: { el: document.querySelector('#review-view'), nav: document.querySelector('#nav-review') },
  };

  function reveal(name) {
    for (const [key, view] of Object.entries(views)) {
      view.el.hidden = key !== name;
      view.nav.classList.toggle('active', key === name);
      if (key === name) view.nav.setAttribute('aria-current', 'page');
      else view.nav.removeAttribute('aria-current');
    }
  }

  const things = await initThingsView(store, views.things.el, {
    sidebar: document.querySelector('#sidebar'),
    reveal: () => reveal('things'),
  });
  const review = await initReviewView(store, views.review.el, {
    openDay: (day) => things.openDay(day),
    openThing: (id) => things.openThing(id),
  });

  async function show(name) {
    if (name === 'things') await things.showHome();
    if (name === 'review') {
      await review.refresh();
      reveal('review');
      things.renderSidebar();
      review.focus();
    }
  }

  views.things.nav.addEventListener('click', () => show('things'));
  views.review.nav.addEventListener('click', () => show('review'));

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  document.querySelector('.nav-hint').textContent = isMac ? '⌘K' : 'Ctrl+K';

  const picker = initPicker(document.querySelector('#picker'), {
    getThings: () => things.getThings(),
    onPick: (id) => things.openThing(id),
    onCreate: (title) => things.createThing(title),
  });

  window.addEventListener('keydown', async (event) => {
    if (event.key === 'Escape' && !picker.isOpen() && (things.isInside() || !views.review.el.hidden)) {
      await show('things');
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      await things.refresh();
      picker.isOpen() ? picker.close() : picker.open();
    }
  });

  // Jotting never asks you to pick a topic first: it goes straight to today's capture line.
  const jot = async () => {
    window.focus();
    await things.showHome();
  };
  const nudge = setupNudge(jot);

  // Hash handoff and polling can overlap; run imports one at a time so neither loses
  // the other's "already imported" ids (which keep deleted notes deleted).
  let importQueue = Promise.resolve();
  function importFromPill(entries, options) {
    importQueue = importQueue.then(() => importNow(entries, options)).catch(() => {});
    return importQueue;
  }

  async function importNow(entries, { redraw }) {
    const added = await importPillEntries(store, entries, localSeenIds());
    if (added.length === 0) return;
    if (redraw) await things.refreshView();
    if (endsASession(added)) {
      nudge.ask('Session done. What’s next?');
    } else {
      const toast = document.querySelector('#import-toast');
      toast.textContent = `Added ${added.length} note${added.length === 1 ? '' : 's'} from Focus Pill`;
      toast.hidden = false;
      clearTimeout(importNow.timer);
      importNow.timer = setTimeout(() => { toast.hidden = true; }, 4000);
    }
  }

  // Focus Pill hands over its notes in the link fragment (#pill=…) when it opens this app.
  async function pullFromHash({ redraw }) {
    const entries = readPillHash(window.location.hash);
    if (!entries) return;
    history.replaceState(null, '', window.location.pathname + window.location.search);
    markPillLinked();
    await importFromPill(entries, { redraw });
  }

  // While the app is open, it also pulls from a running pill on its own.
  // Only once the pill has linked itself, so nobody else gets a local-network prompt.
  const localCopy = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  let polling = false;
  async function pollPill() {
    if (polling || document.hidden || !(isPillLinked() || localCopy)) return;
    polling = true;
    try {
      const entries = await fetchPillOutbox();
      if (entries) {
        markPillLinked();
        await importFromPill(entries, { redraw: true });
      }
    } finally {
      polling = false;
    }
  }

  window.addEventListener('hashchange', async () => {
    if (!window.location.hash.startsWith('#pill=')) return;
    await pullFromHash({ redraw: false });
    await show('things');
  });
  window.addEventListener('focus', pollPill);
  document.addEventListener('visibilitychange', pollPill);
  setInterval(pollPill, 20 * 1000);

  document.querySelector('#export-button')?.addEventListener('click', async () => {
    const data = buildExport(await store.getAllThings(), await store.getAllEntries());
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName();
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  await pullFromHash({ redraw: false });
  await show('things');
  pollPill();
  setupServiceWorker();
}

function setupNudge(jot) {
  const toggle = document.querySelector('#nudge-toggle');
  const toast = document.querySelector('#nudge-toast');
  const message = toast.querySelector('.nudge-message');
  let enabled = readNudgeSetting();
  let lastNudgeAt = Date.now();

  function paint() {
    toggle.textContent = `Nudge: ${enabled ? 'on' : 'off'}`;
    toggle.setAttribute('aria-pressed', String(enabled));
  }

  function ask(text) {
    lastNudgeAt = Date.now();
    message.textContent = text;
    toast.hidden = false;
    clearTimeout(ask.timer);
    ask.timer = setTimeout(() => { toast.hidden = true; }, 15000);
  }

  function nudge() {
    lastNudgeAt = Date.now();
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      const note = new Notification('Anything on your mind?', { silent: true });
      note.onclick = () => { jot(); note.close(); };
    } else {
      ask('Anything on your mind?');
    }
  }

  toggle.addEventListener('click', async () => {
    enabled = !enabled;
    writeNudgeSetting(enabled);
    lastNudgeAt = Date.now();
    paint();
    if (enabled && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  });

  document.querySelector('#nudge-open').addEventListener('click', () => {
    toast.hidden = true;
    jot();
  });

  setInterval(() => {
    if (shouldNudge({ now: Date.now(), enabled, lastNudgeAt })) nudge();
  }, 60 * 1000);

  paint();
  return { ask };
}

function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const toast = document.querySelector('#update-toast');
  const updateButton = document.querySelector('#update-button');
  let waitingWorker = null;
  let refreshing = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  updateButton.addEventListener('click', () => {
    if (waitingWorker) waitingWorker.postMessage('skipWaiting');
  });

  navigator.serviceWorker.register('./service-worker.js').then((registration) => {
    if (registration.waiting) {
      waitingWorker = registration.waiting;
      toast.hidden = false;
    }
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          waitingWorker = newWorker;
          toast.hidden = false;
        }
      });
    });
  });
}

main();
