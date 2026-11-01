import {
  buildThing, sortThings, entriesForThing, inboxEntries, lastNoteAt, relativeDay,
  statusOf, visibleThings, needsSweep, pickSweep, HOME_CAP,
} from './things.js';
import { buildEntry } from './capture.js';
import { groupByDay } from './grouping.js';
import { attachMic } from './voice.js';

const INBOX = 'inbox';
const ARCHIVE = 'archive';
const SWEEP_KEY = 'thoughtcrumbs-last-sweep';

function readSweepAt() {
  try {
    const stored = Number(localStorage.getItem(SWEEP_KEY));
    if (stored) return stored;
    localStorage.setItem(SWEEP_KEY, String(Date.now()));
  } catch { /* storage unavailable */ }
  return Date.now();
}

function writeSweepAt(now) {
  try { localStorage.setItem(SWEEP_KEY, String(now)); } catch { /* storage unavailable */ }
}

export async function initThingsView(store, root) {
  const home = root.querySelector('#things-home');
  const detail = root.querySelector('#thing-detail');
  let things = [];
  let entries = [];
  let current = null;
  let showAll = false;
  let sweep = null;

  async function load() {
    [things, entries] = await Promise.all([store.getAllThings(), store.getAllEntries()]);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // A text box where Enter saves, with a mic button beside it.
  function jotBox(placeholder, onSave) {
    const row = el('div', 'jot-row');
    const textarea = el('textarea', 'jot-input');
    textarea.rows = 1;
    textarea.placeholder = placeholder;
    const mic = el('button', 'mic-button', '🎤');
    mic.type = 'button';
    mic.setAttribute('aria-label', 'Dictate');
    textarea.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter' || event.shiftKey) return;
      event.preventDefault();
      const text = textarea.value;
      textarea.value = '';
      if (text.trim()) await onSave(text);
    });
    row.append(textarea, mic);
    attachMic(mic, textarea);
    return { row, textarea };
  }

  async function touch(thingId) {
    const thing = things.find((t) => t.id === thingId);
    if (thing) await store.updateThing({ ...thing, updatedAt: Date.now() });
  }

  function showUndo(message, undo) {
    const toast = document.querySelector('#undo-toast');
    if (!toast) return;
    toast.querySelector('.undo-message').textContent = message;
    const button = toast.querySelector('button');
    toast.hidden = false;
    clearTimeout(showUndo.timer);
    showUndo.timer = setTimeout(() => { toast.hidden = true; }, 8000);
    button.onclick = async () => {
      toast.hidden = true;
      await undo();
      await load();
      if (current === null) renderHome(false);
    };
  }

  async function setStatus(thing, status, { announce = true } = {}) {
    const before = statusOf(thing);
    await store.updateThing({ ...thing, status, updatedAt: Date.now() });
    if (announce) {
      const verb = status === 'parked' ? 'Parked' : status === 'done' ? 'Done' : 'Back on Home';
      showUndo(`${verb}: ${thing.title}`, () => store.updateThing({ ...thing, status: before }));
    }
    await load();
  }

  function sweepCard(now) {
    const active = things.filter((t) => statusOf(t) === 'active');
    if (sweep === null) {
      sweep = needsSweep(readSweepAt(), now, active.length) ? pickSweep(active, entries) : [];
    }
    if (sweep.length === 0) return null;
    const thing = sweep[0];

    const card = el('div', 'sweep-card');
    card.appendChild(el('p', 'sweep-question', 'Still on your mind?'));
    card.appendChild(el('p', 'sweep-title', thing.title));
    card.appendChild(el('p', 'sweep-hint', `Last note ${relativeDay(lastNoteAt(entries, thing), now)}`));
    const actions = el('div', 'sweep-actions');
    const finish = async (action) => {
      await action();
      sweep.shift();
      if (sweep.length === 0) writeSweepAt(Date.now());
      await load();
      renderHome(false);
    };
    const make = (label, action) => {
      const b = el('button', 'sweep-button', label);
      b.type = 'button';
      b.addEventListener('click', () => finish(action));
      return b;
    };
    actions.append(
      make('Keep', () => store.updateThing({ ...thing, updatedAt: Date.now() })),
      make('Park', () => setStatus(thing, 'parked', { announce: false })),
      make('Done', () => setStatus(thing, 'done', { announce: false })),
    );
    const later = el('button', 'sweep-later', 'Not now');
    later.type = 'button';
    later.addEventListener('click', () => {
      sweep = [];
      writeSweepAt(Date.now());
      renderHome(false);
    });
    actions.appendChild(later);
    card.appendChild(actions);
    return card;
  }

  function backButton() {
    const back = el('button', 'back-button', '← Things');
    back.type = 'button';
    back.addEventListener('click', async () => {
      await load();
      renderHome(true);
    });
    return back;
  }

  function renderHome(focusDump = true) {
    current = null;
    detail.hidden = true;
    home.hidden = false;
    home.innerHTML = '';

    const dump = jotBox('Dump a thought. No need to decide where it goes.', async (text) => {
      const entry = buildEntry(text, Date.now(), null);
      if (!entry) return;
      await store.addEntry(entry);
      await load();
      renderHome(true);
    });
    home.appendChild(dump.row);

    const now = Date.now();
    const card = sweepCard(now);
    if (card) home.appendChild(card);

    const active = sortThings(things.filter((t) => statusOf(t) === 'active'));
    const { shown, hiddenCount } = visibleThings(active, showAll);
    const list = el('div', 'thing-list');
    for (const thing of shown) {
      const row = el('button', 'thing-row');
      row.type = 'button';
      row.append(
        el('span', 'thing-name', thing.title),
        el('span', 'thing-hint', relativeDay(lastNoteAt(entries, thing), now)),
      );
      row.addEventListener('click', () => openThing(thing.id));
      list.appendChild(row);
    }
    const addMuted = (label, onClick) => {
      const row = el('button', 'thing-row muted');
      row.type = 'button';
      row.append(el('span', 'thing-name', label));
      row.addEventListener('click', onClick);
      list.appendChild(row);
    };
    if (hiddenCount > 0) addMuted(`Show ${hiddenCount} more`, () => { showAll = true; renderHome(false); });
    else if (showAll && active.length > HOME_CAP) addMuted('Show fewer', () => { showAll = false; renderHome(false); });
    const inboxCount = inboxEntries(entries).length;
    if (inboxCount > 0) addMuted(`Inbox (${inboxCount})`, () => openInbox());
    const archivedCount = things.length - active.length;
    if (archivedCount > 0) addMuted(`Parked & done (${archivedCount})`, () => openArchive());
    if (things.length === 0 && inboxCount === 0) {
      list.appendChild(el('p', 'empty-state', 'Nothing yet. Dump a thought above.'));
    }
    home.appendChild(list);

    const newButton = el('button', 'new-thing', '+ New thing');
    newButton.type = 'button';
    const newInput = el('input', 'new-thing-input');
    newInput.type = 'text';
    newInput.placeholder = 'Short title, then Enter';
    newInput.hidden = true;
    newButton.addEventListener('click', () => {
      newButton.hidden = true;
      newInput.hidden = false;
      newInput.focus();
    });
    newInput.addEventListener('keydown', async (event) => {
      if (event.key === 'Escape') {
        newInput.value = '';
        newInput.hidden = true;
        newButton.hidden = false;
      } else if (event.key === 'Enter') {
        await createThing(newInput.value);
      }
    });
    home.append(newButton, newInput);
    if (focusDump) dump.textarea.focus();
  }

  async function createThing(title) {
    const thing = buildThing(title, Date.now());
    if (!thing) return null;
    await store.addThing(thing);
    await load();
    openThing(thing.id);
    return thing;
  }

  function renderInbox(listEl) {
    listEl.innerHTML = '';
    const thoughts = inboxEntries(entries);
    if (thoughts.length === 0) {
      listEl.appendChild(el('p', 'empty-state', 'Inbox is empty.'));
      return;
    }
    for (const entry of thoughts) {
      const item = el('li', 'thought');
      item.appendChild(el('span', 'thought-text', entry.text));
      const actions = el('span', 'thought-actions');

      const select = el('select', 'file-under');
      select.appendChild(new Option('Move to…', ''));
      for (const thing of sortThings(things)) select.appendChild(new Option(thing.title, thing.id));
      select.addEventListener('change', async () => {
        if (!select.value) return;
        await store.updateEntry({ ...entry, thingId: select.value });
        await touch(select.value);
        await afterInboxChange(listEl);
      });

      const promote = el('button', 'make-thing', 'Make a thing');
      promote.type = 'button';
      promote.addEventListener('click', async () => {
        const thing = buildThing(entry.text.slice(0, 80), Date.now());
        if (!thing) return;
        await store.addThing(thing);
        await store.deleteEntry(entry.id);
        await load();
        openThing(thing.id);
      });

      actions.append(select, promote);
      item.appendChild(actions);
      listEl.appendChild(item);
    }
  }

  async function afterInboxChange(listEl) {
    await load();
    if (inboxEntries(entries).length === 0) renderHome();
    else renderInbox(listEl);
  }

  function openInbox() {
    current = INBOX;
    home.hidden = true;
    detail.hidden = false;
    detail.innerHTML = '';
    const listEl = el('ul', 'thought-list');
    detail.append(backButton(), el('h2', 'thing-title', 'Inbox'), listEl);
    renderInbox(listEl);
  }

  function openArchive() {
    current = ARCHIVE;
    home.hidden = true;
    detail.hidden = false;
    detail.innerHTML = '';
    const listEl = el('ul', 'thought-list');
    detail.append(backButton(), el('h2', 'thing-title', 'Parked & done'), listEl);
    const archived = sortThings(things.filter((t) => statusOf(t) !== 'active'));
    if (archived.length === 0) {
      listEl.appendChild(el('p', 'empty-state', 'Nothing parked.'));
      return;
    }
    for (const thing of archived) {
      const item = el('li', 'thought');
      const open = el('button', 'archive-name', thing.title);
      open.type = 'button';
      open.addEventListener('click', () => openThing(thing.id));
      const actions = el('span', 'thought-actions');
      actions.append(el('span', 'thing-hint', statusOf(thing)));
      const back = el('button', 'make-thing', 'Bring back');
      back.type = 'button';
      back.addEventListener('click', async () => {
        await setStatus(thing, 'active', { announce: false });
        openArchive();
      });
      actions.appendChild(back);
      item.append(open, actions);
      listEl.appendChild(item);
    }
  }

  function renderThoughts(container, thingId) {
    container.innerHTML = '';
    const thoughts = entriesForThing(entries, thingId);
    if (thoughts.length === 0) {
      container.appendChild(el('p', 'empty-state', 'No thoughts yet.'));
      return;
    }
    for (const group of groupByDay(thoughts)) {
      container.appendChild(el('h3', 'day-heading', group.label));
      const list = el('ul', 'thought-list');
      for (const entry of group.entries) {
        const item = el('li', 'thought');
        item.appendChild(el('span', 'thought-text', entry.text));
        list.appendChild(item);
      }
      container.appendChild(list);
    }
  }

  function openThing(thingId) {
    current = thingId;
    home.hidden = true;
    detail.hidden = false;
    detail.innerHTML = '';

    const thing = things.find((t) => t.id === thingId);
    detail.append(backButton(), el('h2', 'thing-title', thing.title));
    if (statusOf(thing) === 'active') {
      const row = el('div', 'thing-actions-row');
      for (const [label, status] of [['Park', 'parked'], ['Done', 'done']]) {
        const b = el('button', 'make-thing', label);
        b.type = 'button';
        b.addEventListener('click', async () => {
          await setStatus(thing, status);
          renderHome(true);
        });
        row.appendChild(b);
      }
      detail.appendChild(row);
    }
    if (entriesForThing(entries, thingId).length > 0) {
      detail.appendChild(el('p', 'last-note', `Last note: ${relativeDay(lastNoteAt(entries, thing))}`));
    }

    const history = el('div', 'thought-history');
    const jot = jotBox('Jot a thought…', async (text) => {
      const entry = buildEntry(text, Date.now(), thingId);
      if (!entry) return;
      await store.addEntry(entry);
      await touch(thingId);
      await load();
      renderThoughts(history, thingId);
    });
    detail.append(jot.row, history);
    jot.textarea.focus();
    renderThoughts(history, thingId);
  }

  async function refresh() {
    await load();
    if (current === INBOX) openInbox();
    else if (current === ARCHIVE) openArchive();
    else if (current) openThing(current);
    else renderHome();
  }

  await load();
  renderHome(true);
  return {
    refresh,
    showHome: async () => { await load(); renderHome(true); },
    isInside: () => current !== null,
    openThing: async (id) => { await load(); openThing(id); },
    createThing,
    getThings: () => things,
  };
}
