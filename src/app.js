import { openStore } from './db.js';
import { initReviewView } from './review.js';
import { initThingsView } from './things-view.js';
import { initPicker } from './picker.js';
import { shouldNudge } from './nudge.js';

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

  const review = await initReviewView(store, views.review.el);
  const things = await initThingsView(store, views.things.el);

  async function show(name) {
    if (name === 'review') await review.refresh();
    if (name === 'things') await things.showHome();
    for (const [key, view] of Object.entries(views)) {
      view.el.hidden = key !== name;
      view.nav.classList.toggle('active', key === name);
    }
  }

  for (const [name, view] of Object.entries(views)) {
    view.nav.addEventListener('click', () => show(name));
  }

  const picker = initPicker(document.querySelector('#picker'), {
    getThings: () => things.getThings(),
    onPick: async (id) => { await show('things'); await things.openThing(id); },
    onCreate: async (title) => { await show('things'); await things.createThing(title); },
  });

  window.addEventListener('keydown', async (event) => {
    if (event.key === 'Escape' && !picker.isOpen() && things.isInside()) {
      await things.showHome();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      await things.refresh();
      picker.isOpen() ? picker.close() : picker.open();
    }
  });

  setupNudge(() => picker.open());
  await show('things');
  setupServiceWorker();
}

function setupNudge(openPicker) {
  const toggle = document.querySelector('#nudge-toggle');
  const toast = document.querySelector('#nudge-toast');
  let enabled = readNudgeSetting();
  let lastNudgeAt = Date.now();

  function paint() {
    toggle.textContent = `Nudge: ${enabled ? 'on' : 'off'}`;
    toggle.setAttribute('aria-pressed', String(enabled));
  }

  function nudge() {
    lastNudgeAt = Date.now();
    if ('Notification' in window && Notification.permission === 'granted') {
      const note = new Notification('Anything on your mind?', { silent: true });
      note.onclick = () => { window.focus(); openPicker(); note.close(); };
    } else {
      toast.hidden = false;
      setTimeout(() => { toast.hidden = true; }, 15000);
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
    openPicker();
  });

  setInterval(() => {
    if (shouldNudge({ now: Date.now(), enabled, lastNudgeAt })) nudge();
  }, 60 * 1000);

  paint();
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
