import {
  buildThing, sortThings, entriesForThing, inboxEntries, lastNoteAt, relativeDay,
  statusOf, visibleThings, needsSweep, pickSweep, HOME_CAP,
} from './things.js';
import { buildEntry } from './capture.js';
import {
  startOfDay, addDays, clock, weekday, longDate, dayHeading, shortDate,
  entriesOnDay, groupByDayAscending, daysWithEntries,
} from './days.js';
import { renderCalendar } from './calendar.js';
import { renderGraph } from './graph.js';
import { daySummary, leftOffAt, hoursAgo } from './recap.js';

const SWEEP_KEY = 'thoughtcrumbs-last-sweep';
const GRAPH_KEY = 'thoughtcrumbs-show-links';

// Interstitial journaling asks the same small questions each time; a tap starts the line.
const PROMPTS = ['Just did', 'Next I’ll', 'Stuck on'];

function readShowGraph() {
  try { return localStorage.getItem(GRAPH_KEY) === 'on'; } catch { return false; }
}

function writeShowGraph(on) {
  try { localStorage.setItem(GRAPH_KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
}

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
  let showGraph = readShowGraph();
  let lastGraph = null;
  const graphToggle = sidebar?.querySelector('#graph-toggle');

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

  function header(title, subtitle, beside = []) {
    const head = el('header', 'page-head');
    const row = el('div', 'title-row');
    row.append(el('h1', 'page-title', title), ...beside);
    const sub = el('p', 'page-subtitle');
    sub.append(...subtitle);
    head.append(row, sub);
    return head;
  }

  const muted = (text) => el('span', 'muted', text);
  const dot = () => el('span', 'sep', ' · ');

  // The time, then a field where Enter saves and clears for the next thought.
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
    const prompts = el('div', 'prompts');
    const paintPrompts = () => { prompts.hidden = input.value.trim() !== ''; };
    for (const label of PROMPTS) {
      prompts.appendChild(textButton(`${label}…`, 'prompt', () => {
        input.value = `${label}: `;
        fit();
        paintPrompts();
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }));
    }
    input.addEventListener('input', () => { fit(); paintPrompts(); });
    input.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      const text = input.value;
      input.value = '';
      fit();
      paintPrompts();
      if (text.trim()) await onSave(text);
    });
    const body = el('div', 'capture-body');
    body.append(input, prompts);
    li.append(time, body);
    return { li, input };
  }

  function noteItem(entry, { linkThing = true } = {}) {
    const li = el('li', 'note');
    const body = el('div', 'note-body');
    body.append(el('span', 'note-text', entry.text));
    const thing = linkThing && entry.thingId ? thingById(entry.thingId) : null;
    if (thing) body.append(' ', linkTo(thing.title, 'chip', () => openThing(thing.id)));
    li.append(el('span', 'note-time', clock(entry.createdAt)), body);
    return li;
  }

  function dayGroup(day) {
    const section = el('section', 'day-group');
    const heading = el('h3', 'day-heading');
    heading.appendChild(linkTo(day === today() ? 'Today' : dayHeading(day), 'day-link', () => openDay(day)));
    const list = el('ul', 'notes');
    section.append(heading, list);
    return { section, list };
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
      const verb = status === 'parked' ? 'Parked' : status === 'done' ? 'Done' : 'Back on your list';
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
    lastGraph = graph;
    paintGraph();
  }

  // The links graph is extra detail, so it stays folded away until you ask for it.
  function paintGraph() {
    if (!graphEl) return;
    if (graphToggle) {
      graphToggle.hidden = !lastGraph;
      graphToggle.textContent = showGraph ? 'Hide links' : 'Show links';
      graphToggle.setAttribute('aria-expanded', String(showGraph));
    }
    if (lastGraph && showGraph) {
      graphEl.hidden = false;
      renderGraph(graphEl, lastGraph);
    } else {
      graphEl.hidden = true;
    }
  }

  graphToggle?.addEventListener('click', () => {
    showGraph = !showGraph;
    writeShowGraph(showGraph);
    paintGraph();
  });

  // After a long gap, today's page opens with the last thing you wrote.
  function leftOffLine(now) {
    const last = leftOffAt(entries, now);
    if (!last) return null;
    const box = el('section', 'left-off');
    const label = el('p', 'left-off-label');
    label.append('Where you left off', dot(), muted(hoursAgo(last.createdAt, now) ?? relativeDay(last.createdAt, now)));
    const text = el('p', 'left-off-text');
    text.append(el('span', 'note-text', last.text));
    const thing = last.thingId ? thingById(last.thingId) : null;
    if (thing) text.append(' ', linkTo(thing.title, 'chip', () => openThing(thing.id)));
    box.append(label, text);
    return box;
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
    box.appendChild(el('p', 'box-label', 'Still on your mind?'));
    const line = el('p', 'sweep-line');
    line.append(
      linkTo(thing.title, 'sweep-title', () => openThing(thing.id)),
      muted(`Last note ${relativeDay(lastNoteAt(entries, thing), now)}`),
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
      textButton('Keep', 'pill', () => finish(() => store.updateThing({ ...thing, updatedAt: Date.now() }))),
      textButton('Park', 'pill', () => finish(() => setStatus(thing, 'parked', { announce: false }))),
      textButton('Done', 'pill', () => finish(() => setStatus(thing, 'done', { announce: false }))),
      textButton('Not now', 'action quiet', () => {
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
    const active = sortThings(things.filter((t) => statusOf(t) === 'active'));
    const label = el('p', 'box-label');
    label.append('On your mind', active.length ? muted(String(active.length)) : '');
    box.appendChild(label);

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
      list.appendChild(el('li', 'box-empty', 'Nothing here yet. Add a thing, or just write below.'));
    }
    box.appendChild(list);

    const foot = el('p', 'box-foot');
    const newInput = el('input', 'inline-input');
    newInput.type = 'text';
    newInput.placeholder = 'Short title, then Enter';
    newInput.setAttribute('aria-label', 'New thing title');
    newInput.hidden = true;
    const newButton = textButton('New thing', 'action strong', () => {
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
    if (hiddenCount > 0) foot.append(textButton(`Show ${hiddenCount} more`, 'action', () => { showAll = true; renderDay(today(), { focus: false }); }));
    else if (showAll && active.length > HOME_CAP) foot.append(textButton('Show fewer', 'action', () => { showAll = false; renderDay(today(), { focus: false }); }));
    const inboxCount = inboxEntries(entries).length;
    if (inboxCount > 0) foot.append(textButton(`Inbox ${inboxCount}`, 'action', openInbox));
    const archivedCount = things.length - active.length;
    if (archivedCount > 0) foot.append(textButton(`Parked & done ${archivedCount}`, 'action', openArchive));
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
    const steps = el('span', 'steps');
    steps.append(prev, next);
    const subtitle = [muted(longDate(day))];
    if (isToday) subtitle.push(dot(), muted('Today'));
    else subtitle.push(dot(), linkTo('Back to today', 'link', () => openDay(today())));
    for (const part of daySummary(entries, day)) subtitle.push(dot(), muted(part));
    page.appendChild(header(weekday(day), subtitle, [steps]));

    if (isToday) {
      const leftOff = leftOffLine(now);
      if (leftOff) page.appendChild(leftOff);
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
      capture = captureLine(todays.length ? 'Next thought…' : 'What’s on your mind?', async (text) => {
        const entry = buildEntry(text, Date.now(), null);
        if (!entry) return;
        await store.addEntry(entry);
        await load();
        renderDay(today(), { focus: true });
      });
      list.appendChild(capture.li);
    } else if (todays.length === 0) {
      list.appendChild(el('li', 'empty', 'Nothing written this day.'));
    }
    page.appendChild(list);

    const linked = new Map();
    for (const entry of todays) {
      const thing = entry.thingId ? thingById(entry.thingId) : null;
      if (thing) linked.set(thing.id, { label: thing.title, onOpen: () => openThing(thing.id) });
      else if (entry.thingId === null) linked.set('inbox', { label: 'Inbox', onOpen: openInbox });
    }
    renderSidebar(day, { center: dayHeading(day), nodes: [...linked.values()] });
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
    const subtitle = [];
    if (status !== 'active') subtitle.push(muted(status === 'done' ? 'Done' : 'Parked'), dot());
    subtitle.push(muted(notes.length ? `Last note ${relativeDay(lastNoteAt(entries, thing))}` : 'No notes yet'));
    page.appendChild(header(thing.title, subtitle));

    const actions = el('p', 'actions page-actions');
    if (status === 'active') {
      for (const [label, next] of [['Park', 'parked'], ['Done', 'done']]) {
        actions.appendChild(textButton(label, 'pill', async () => {
          await setStatus(thing, next);
          renderDay(today());
        }));
      }
    } else {
      actions.appendChild(textButton('Bring back', 'pill', async () => {
        await setStatus(thing, 'active');
        renderThing(thingId);
      }));
    }
    page.appendChild(actions);

    const groups = groupByDayAscending(notes);
    if (groups.length === 0 || groups[groups.length - 1].day !== today()) {
      groups.push({ day: today(), entries: [] });
    }
    let capture = null;
    for (const group of groups) {
      const { section, list: nested } = dayGroup(group.day);
      group.entries.forEach((entry) => nested.appendChild(noteItem(entry, { linkThing: false })));
      if (group.day === today()) {
        capture = captureLine('Jot a thought…', async (text) => {
          const entry = buildEntry(text, Date.now(), thingId);
          if (!entry) return;
          await store.addEntry(entry);
          await touch(thingId);
          await load();
          renderThing(thingId);
        });
        nested.appendChild(capture.li);
      }
      page.appendChild(section);
    }

    const days = [...new Set(notes.map((e) => startOfDay(e.createdAt)))].sort((a, b) => b - a);
    renderSidebar(null, {
      center: thing.title,
      nodes: days.map((day) => ({ label: shortDate(day), onOpen: () => openDay(day) })),
    });
    capture.input.focus({ preventScroll: fresh });
  }

  // ---- inbox and archive --------------------------------------------------------

  function renderInbox() {
    start({ kind: 'inbox' });
    const thoughts = inboxEntries(entries);
    page.appendChild(header('Inbox', [muted('Notes that don’t belong to a thing yet')]));
    if (thoughts.length === 0) page.appendChild(el('p', 'empty', 'Inbox is empty.'));
    for (const group of groupByDayAscending(thoughts)) {
      const { section, list: nested } = dayGroup(group.day);
      for (const entry of group.entries) {
        const item = noteItem(entry);
        const actions = el('div', 'note-actions');
        const select = el('select', 'move-to');
        select.setAttribute('aria-label', 'Move to thing');
        select.appendChild(new Option('Move to…', ''));
        for (const thing of sortThings(things)) select.appendChild(new Option(thing.title, thing.id));
        select.addEventListener('change', async () => {
          if (!select.value) return;
          await store.updateEntry({ ...entry, thingId: select.value });
          await touch(select.value);
          await load();
          if (inboxEntries(entries).length === 0) renderDay(today());
          else renderInbox();
        });
        const promote = textButton('Make a thing', 'action', async () => {
          const thing = buildThing(entry.text.slice(0, 80), Date.now());
          if (!thing) return;
          await store.addThing(thing);
          await store.deleteEntry(entry.id);
          await load();
          renderThing(thing.id);
        });
        actions.append(select, promote);
        item.querySelector('.note-body').appendChild(actions);
        nested.appendChild(item);
      }
      page.appendChild(section);
    }
    renderSidebar(null, null);
  }

  function renderArchive() {
    start({ kind: 'archive' });
    page.appendChild(header('Parked & done', [muted('Things you set aside or finished')]));
    const archived = sortThings(things.filter((t) => statusOf(t) !== 'active'));
    if (archived.length === 0) {
      page.appendChild(el('p', 'empty', 'Nothing parked.'));
    } else {
      const box = el('section', 'box');
      const list = el('ul', 'box-list');
      for (const thing of archived) {
        const li = el('li', 'box-line');
        li.append(
          linkTo(thing.title, 'row-title', () => openThing(thing.id)),
          muted(statusOf(thing) === 'done' ? 'Done' : 'Parked'),
          textButton('Bring back', 'action', async () => {
            await setStatus(thing, 'active', { announce: false });
            renderArchive();
          }),
        );
        list.appendChild(li);
      }
      box.appendChild(list);
      page.appendChild(box);
    }
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

  // New notes arrived from elsewhere: redraw, unless you're in the middle of typing one.
  async function refreshView() {
    await load();
    const active = document.activeElement;
    const typing = active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName);
    if (typing && (active.tagName === 'SELECT' || active.value.trim())) return;
    if (!root.hidden) rerender(active?.classList?.contains('capture-input') ?? false);
  }

  await load();
  return {
    refresh: load,
    refreshView,
    getEntries: () => entries,
    showHome: async () => { await load(); renderDay(today()); },
    isInside: () => !(view.kind === 'day' && view.day === today()),
    openThing: async (id) => { await load(); renderThing(id); },
    openDay: async (day) => { await load(); openDay(day); },
    renderSidebar: () => renderSidebar(null, null),
    createThing,
    getThings: () => things,
  };
}
