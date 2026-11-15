import {
  buildThing, sortThings, entriesForThing, inboxEntries, lastNoteAt, relativeDay,
  statusOf, visibleThings, needsSweep, pickSweep, HOME_CAP,
} from './things.js';
import { buildEntry } from './capture.js';
import {
  startOfDay, addDays, dayKey, clock, weekday, entriesOnDay, groupByDayAscending, daysWithEntries,
} from './days.js';
import { renderCalendar } from './calendar.js';
import { renderGraph } from './graph.js';

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

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function textButton(label, className, onClick) {
  const b = el('button', className, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

// Inline links are anchors so long titles wrap mid-line like text.
function linkTo(label, className, onClick) {
  const a = el('a', className, label);
  a.href = '#';
  a.addEventListener('click', (event) => {
    event.preventDefault();
    onClick();
  });
  return a;
}

const today = () => startOfDay(Date.now());

// The journal: a daily note per day, a page per thing, plus inbox and archive pages.
// `reveal` is called whenever this view takes over the screen.
export async function initThingsView(store, root, { sidebar, reveal = () => {} } = {}) {
  const page = root.querySelector('#page');
  const calendarEl = sidebar?.querySelector('#calendar');
  const graphEl = sidebar?.querySelector('#graph');
  let things = [];
  let entries = [];
  let view = { kind: 'day', day: today() };
  let month = null;
  let showAll = false;
  let sweep = null;

  async function load() {
    [things, entries] = await Promise.all([store.getAllThings(), store.getAllEntries()]);
  }

  const thingById = (id) => things.find((t) => t.id === id);

  // Returns true when this is a different page, so the caller knows to start at the top.
  // Re-rendering the same page (after saving a note) keeps the scroll position.
  function start(next) {
    const fresh = next.kind !== view.kind || next.day !== view.day || next.id !== view.id || page.childElementCount === 0;
    view = next;
    reveal();
    page.innerHTML = '';
    if (fresh) window.scrollTo(0, 0);
    return fresh;
  }

  function header(title, tag, beside = []) {
    const head = el('header', 'page-head');
    const row = el('div', 'title-row');
    row.append(el('h1', 'page-title', title), ...beside);
    const tagLine = el('p', 'page-tag');
    tagLine.append(...tag);
    head.append(row, tagLine, el('hr', 'rule'));
    return head;
  }

  const tag = (text) => el('span', 'tag', text);
  const dot = () => el('span', 'sep', ' · ');

  // `HH:MM - ` followed by a box where Enter saves and the box clears for the next thought.
  function captureLine(placeholder, onSave) {
    const li = el('li', 'note capture');
    const time = el('span', 'note-time', clock(Date.now()));
    const input = el('textarea', 'capture-input');
    input.rows = 1;
    input.placeholder = placeholder;
    input.setAttribute('aria-label', 'New note');
    const fit = () => {
      input.style.height = 'auto';
      input.style.height = `${input.scrollHeight}px`;
    };
    input.addEventListener('input', fit);
    input.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      const text = input.value;
      input.value = '';
      fit();
      if (text.trim()) await onSave(text);
    });
    li.append(time, el('span', 'note-dash', ' - '), input);
    return { li, input };
  }

  function noteItem(entry, { linkThing = true } = {}) {
    const li = el('li', 'note');
    li.append(el('span', 'note-time', clock(entry.createdAt)), el('span', 'note-dash', ' - '));
    li.append(el('span', 'note-text', entry.text));
    const thing = linkThing && entry.thingId ? thingById(entry.thingId) : null;
    if (thing) {
      li.append(' ', linkTo(thing.title, 'link', () => openThing(thing.id)));
    }
    return li;
  }

  function dayLink(day) {
    return linkTo(dayKey(day), 'link day-link', () => openDay(day));
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
      if (!root.hidden) rerender(false);
    };
  }

  async function setStatus(thing, status, { announce = true } = {}) {
    const before = statusOf(thing);
    await store.updateThing({ ...thing, status, updatedAt: Date.now() });
    if (announce) {
      const verb = status === 'parked' ? 'Parked' : status === 'done' ? 'Done' : 'Back on today';
      showUndo(`${verb}: ${thing.title}`, () => store.updateThing({ ...thing, status: before }));
    }
    await load();
  }

  async function touch(thingId) {
    const thing = thingById(thingId);
    if (thing) await store.updateThing({ ...thing, updatedAt: Date.now() });
  }

  // ---- sidebar ----------------------------------------------------------------

  function renderSidebar(selectedDay, graph) {
    if (!calendarEl) return;
    if (month === null || selectedDay !== null) {
      const d = new Date(selectedDay ?? today());
      month = { year: d.getFullYear(), month: d.getMonth() };
    }
    const paintCalendar = () => renderCalendar(calendarEl, {
      ...month,
      selected: selectedDay,
      marked: daysWithEntries(entries),
      onPickDay: (day) => openDay(day, '.cal-day.selected'),
      onMonth: (step) => {
        const d = new Date(month.year, month.month + step, 1);
        month = { year: d.getFullYear(), month: d.getMonth() };
        paintCalendar();
        calendarEl.querySelector(`[aria-label="${step < 0 ? 'Previous' : 'Next'} month"]`).focus();
      },
    });
    paintCalendar();
    if (graph) {
      graphEl.hidden = false;
      renderGraph(graphEl, graph);
    } else {
      graphEl.hidden = true;
    }
  }

  // ---- daily note -------------------------------------------------------------

  function sweepBox(now) {
    const active = things.filter((t) => statusOf(t) === 'active');
    if (sweep === null) {
      sweep = needsSweep(readSweepAt(), now, active.length) ? pickSweep(active, entries) : [];
    }
    // Re-read each thing: it may have been parked or edited on its own page since.
    const before = sweep.length;
    sweep = sweep.map((t) => thingById(t.id)).filter((t) => t && statusOf(t) === 'active');
    if (before > 0 && sweep.length === 0) writeSweepAt(now);
    if (sweep.length === 0) return null;
    const thing = sweep[0];

    const box = el('section', 'box sweep');
    box.appendChild(el('p', 'box-label', 'still on your mind?'));
    const line = el('p', 'sweep-line');
    line.append(
      linkTo(thing.title, 'link', () => openThing(thing.id)),
      el('span', 'muted', ` · last note ${relativeDay(lastNoteAt(entries, thing), now)}`),
    );
    box.appendChild(line);
    const finish = async (action) => {
      await action();
      sweep.shift();
      if (sweep.length === 0) writeSweepAt(Date.now());
      await load();
      renderDay(today(), { focus: false });
    };
    const actions = el('p', 'actions');
    actions.append(
      textButton('keep', 'action', () => finish(() => store.updateThing({ ...thing, updatedAt: Date.now() }))),
      textButton('park', 'action', () => finish(() => setStatus(thing, 'parked', { announce: false }))),
      textButton('done', 'action', () => finish(() => setStatus(thing, 'done', { announce: false }))),
      textButton('not now', 'action quiet', () => {
        sweep = [];
        writeSweepAt(Date.now());
        renderDay(today(), { focus: false });
      }),
    );
    box.appendChild(actions);
    return box;
  }

  function thingsBox(now) {
    const box = el('section', 'box');
    const label = el('p', 'box-label');
    label.append(el('span', 'box-icon', '✧'), ' things');
    box.appendChild(label);

    const active = sortThings(things.filter((t) => statusOf(t) === 'active'));
    const doneToday = things.filter((t) => statusOf(t) === 'done' && startOfDay(t.updatedAt) === today());
    const { shown, hiddenCount } = visibleThings(active, showAll);
    const list = el('ul', 'box-list');
    const row = (thing, done) => {
      const li = el('li');
      const b = el('button', done ? 'box-row done' : 'box-row');
      b.type = 'button';
      b.append(el('span', 'row-title', thing.title));
      if (!done) b.append(el('span', 'row-hint', relativeDay(lastNoteAt(entries, thing), now)));
      b.addEventListener('click', () => openThing(thing.id));
      li.appendChild(b);
      return li;
    };
    shown.forEach((t) => list.appendChild(row(t, false)));
    doneToday.forEach((t) => list.appendChild(row(t, true)));
    if (shown.length === 0 && doneToday.length === 0) {
      list.appendChild(el('li', 'muted', 'nothing here yet. add a thing, or just write below.'));
    }
    box.appendChild(list);

    const foot = el('p', 'box-foot');
    const newInput = el('input', 'inline-input');
    newInput.type = 'text';
    newInput.placeholder = 'short title, then enter';
    newInput.setAttribute('aria-label', 'New thing title');
    newInput.hidden = true;
    const newButton = textButton('+ new thing', 'action', () => {
      foot.hidden = true;
      newInput.hidden = false;
      newInput.focus();
    });
    newInput.addEventListener('keydown', async (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        newInput.value = '';
        newInput.hidden = true;
        foot.hidden = false;
      } else if (event.key === 'Enter') {
        await createThing(newInput.value);
      }
    });
    foot.appendChild(newButton);
    if (hiddenCount > 0) foot.append(textButton(`show ${hiddenCount} more`, 'action', () => { showAll = true; renderDay(today(), { focus: false }); }));
    else if (showAll && active.length > HOME_CAP) foot.append(textButton('show fewer', 'action', () => { showAll = false; renderDay(today(), { focus: false }); }));
    const inboxCount = inboxEntries(entries).length;
    if (inboxCount > 0) foot.append(textButton(`inbox (${inboxCount})`, 'action', openInbox));
    const archivedCount = things.length - active.length;
    if (archivedCount > 0) foot.append(textButton(`parked & done (${archivedCount})`, 'action', openArchive));
    box.append(foot, newInput);
    return box;
  }

  // `focusAfter` puts keyboard focus back on the control that rebuilt the page.
  function renderDay(day, { focus = true, focusAfter = null } = {}) {
    const fresh = start({ kind: 'day', day });
    const now = Date.now();
    const isToday = day === today();

    const prev = textButton('‹', 'step', () => openDay(addDays(day, -1), '.step[data-step="prev"]'));
    const next = textButton('›', 'step', () => openDay(addDays(day, 1), '.step[data-step="next"]'));
    prev.dataset.step = 'prev';
    next.dataset.step = 'next';
    prev.setAttribute('aria-label', 'Previous day');
    next.setAttribute('aria-label', 'Next day');
    const tagParts = [tag('#daily'), dot(), el('span', 'muted', weekday(day))];
    if (!isToday) tagParts.push(dot(), linkTo('back to today', 'link', () => openDay(today())));
    page.appendChild(header(dayKey(day), tagParts, [prev, next]));

    if (isToday) {
      page.appendChild(thingsBox(now));
      const card = sweepBox(now);
      if (card) page.appendChild(card);
    }

    page.appendChild(el('h2', 'section-title', 'Notes'));
    const list = el('ul', 'notes');
    const todays = entriesOnDay(entries, day);
    todays.forEach((entry) => list.appendChild(noteItem(entry)));
    let capture = null;
    if (isToday) {
      capture = captureLine(todays.length ? 'next thought…' : 'what’s on your mind?', async (text) => {
        const entry = buildEntry(text, Date.now(), null);
        if (!entry) return;
        await store.addEntry(entry);
        await load();
        renderDay(today(), { focus: true });
      });
      list.appendChild(capture.li);
    } else if (todays.length === 0) {
      list.appendChild(el('li', 'note muted', 'nothing written this day.'));
    }
    page.appendChild(list);

    const linked = new Map();
    for (const entry of todays) {
      const thing = entry.thingId ? thingById(entry.thingId) : null;
      if (thing) linked.set(thing.id, { label: thing.title, onOpen: () => openThing(thing.id) });
      else if (entry.thingId === null) linked.set('inbox', { label: 'inbox', onOpen: openInbox });
    }
    renderSidebar(day, { center: dayKey(day), nodes: [...linked.values()] });
    const target = focusAfter && document.querySelector(focusAfter);
    if (target) target.focus();
    else if (focus && capture) capture.input.focus({ preventScroll: fresh });
  }

  // ---- thing page -------------------------------------------------------------

  function renderThing(thingId) {
    const thing = thingById(thingId);
    if (!thing) { renderDay(today()); return; }
    const fresh = start({ kind: 'thing', id: thingId });
    const status = statusOf(thing);
    const notes = entriesForThing(entries, thingId);
    const tagParts = [tag('#thing')];
    if (status !== 'active') tagParts.push(dot(), el('span', 'muted', status));
    if (notes.length) tagParts.push(dot(), el('span', 'muted', `last note ${relativeDay(lastNoteAt(entries, thing))}`));
    page.appendChild(header(thing.title, tagParts));

    const actions = el('p', 'actions page-actions');
    if (status === 'active') {
      for (const [label, next] of [['park', 'parked'], ['done', 'done']]) {
        actions.appendChild(textButton(label, 'action', async () => {
          await setStatus(thing, next);
          renderDay(today());
        }));
      }
    } else {
      actions.appendChild(textButton('bring back', 'action', async () => {
        await setStatus(thing, 'active');
        renderThing(thingId);
      }));
    }
    page.appendChild(actions);

    page.appendChild(el('h2', 'section-title', 'Notes'));
    const list = el('ul', 'notes');
    const groups = groupByDayAscending(notes);
    if (groups.length === 0 || groups[groups.length - 1].day !== today()) {
      groups.push({ day: today(), entries: [] });
    }
    let capture = null;
    for (const group of groups) {
      const li = el('li', 'note day-node');
      li.append(dayLink(group.day), el('span', 'muted', ` ${weekday(group.day).slice(0, 3)}`));
      const nested = el('ul', 'notes nested');
      group.entries.forEach((entry) => nested.appendChild(noteItem(entry, { linkThing: false })));
      if (group.day === today()) {
        capture = captureLine('jot a thought…', async (text) => {
          const entry = buildEntry(text, Date.now(), thingId);
          if (!entry) return;
          await store.addEntry(entry);
          await touch(thingId);
          await load();
          renderThing(thingId);
        });
        nested.appendChild(capture.li);
      }
      li.appendChild(nested);
      list.appendChild(li);
    }
    page.appendChild(list);

    const days = [...new Set(notes.map((e) => startOfDay(e.createdAt)))].sort((a, b) => b - a);
    renderSidebar(null, {
      center: thing.title,
      nodes: days.map((day) => ({ label: dayKey(day).slice(5), onOpen: () => openDay(day) })),
    });
    capture.input.focus({ preventScroll: fresh });
  }

  // ---- inbox and archive --------------------------------------------------------

  function renderInbox() {
    start({ kind: 'inbox' });
    const thoughts = inboxEntries(entries);
    page.appendChild(header('inbox', [tag('#inbox'), dot(), el('span', 'muted', 'notes without a thing yet')]));
    const list = el('ul', 'notes');
    if (thoughts.length === 0) list.appendChild(el('li', 'note muted', 'inbox is empty.'));
    for (const group of groupByDayAscending(thoughts)) {
      const li = el('li', 'note day-node');
      li.appendChild(dayLink(group.day));
      const nested = el('ul', 'notes nested');
      for (const entry of group.entries) {
        const item = noteItem(entry);
        const actions = el('div', 'note-actions');
        const select = el('select', 'move-to');
        select.setAttribute('aria-label', 'Move to thing');
        select.appendChild(new Option('move to…', ''));
        for (const thing of sortThings(things)) select.appendChild(new Option(thing.title, thing.id));
        select.addEventListener('change', async () => {
          if (!select.value) return;
          await store.updateEntry({ ...entry, thingId: select.value });
          await touch(select.value);
          await load();
          if (inboxEntries(entries).length === 0) renderDay(today());
          else renderInbox();
        });
        const promote = textButton('make a thing', 'action', async () => {
          const thing = buildThing(entry.text.slice(0, 80), Date.now());
          if (!thing) return;
          await store.addThing(thing);
          await store.deleteEntry(entry.id);
          await load();
          renderThing(thing.id);
        });
        actions.append(select, promote);
        item.appendChild(actions);
        nested.appendChild(item);
      }
      li.appendChild(nested);
      list.appendChild(li);
    }
    page.appendChild(list);
    renderSidebar(null, null);
  }

  function renderArchive() {
    start({ kind: 'archive' });
    page.appendChild(header('parked & done', [tag('#archive')]));
    const list = el('ul', 'notes');
    const archived = sortThings(things.filter((t) => statusOf(t) !== 'active'));
    if (archived.length === 0) list.appendChild(el('li', 'note muted', 'nothing parked.'));
    for (const thing of archived) {
      const li = el('li', 'note');
      li.append(
        linkTo(thing.title, 'link', () => openThing(thing.id)),
        el('span', 'muted', ` · ${statusOf(thing)} · `),
        textButton('bring back', 'action', async () => {
          await setStatus(thing, 'active', { announce: false });
          renderArchive();
        }),
      );
      list.appendChild(li);
    }
    page.appendChild(list);
    renderSidebar(null, null);
  }

  // ---- navigation -------------------------------------------------------------

  function openDay(day, focusAfter = null) {
    const dayStart = startOfDay(day);
    const isToday = dayStart === today();
    renderDay(dayStart, { focus: isToday, focusAfter: isToday ? null : focusAfter });
  }
  function openThing(id) { renderThing(id); }
  function openInbox() { renderInbox(); }
  function openArchive() { renderArchive(); }

  function rerender(focus = true) {
    if (view.kind === 'thing') renderThing(view.id);
    else if (view.kind === 'inbox') renderInbox();
    else if (view.kind === 'archive') renderArchive();
    else renderDay(view.day, { focus });
  }

  async function createThing(title) {
    const thing = buildThing(title, Date.now());
    if (!thing) return null;
    await store.addThing(thing);
    await load();
    renderThing(thing.id);
    return thing;
  }

  // Keep the `HH:MM` on the capture line current while the page stays open.
  setInterval(() => {
    for (const node of page.querySelectorAll('.capture .note-time')) node.textContent = clock(Date.now());
  }, 15000);

  await load();
  return {
    refresh: load,
    showHome: async () => { await load(); renderDay(today()); },
    isInside: () => !(view.kind === 'day' && view.day === today()),
    openThing: async (id) => { await load(); renderThing(id); },
    openDay: async (day) => { await load(); openDay(day); },
    renderSidebar: () => renderSidebar(null, null),
    createThing,
    getThings: () => things,
  };
}
