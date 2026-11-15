import { searchEntries, filterByDateRange } from './filters.js';
import { groupByDayAscending, dayKey, clock, weekday } from './days.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function link(label, className, onClick) {
  const a = el('a', className, label);
  a.href = '#';
  a.addEventListener('click', (event) => {
    event.preventDefault();
    onClick();
  });
  return a;
}

// Newest day first, each day's notes oldest first, like flipping back through daily notes.
function renderResults(listEl, entries, hasAnyEntries, thingTitles, { openDay, openThing }) {
  listEl.innerHTML = '';
  if (entries.length === 0) {
    listEl.appendChild(el('li', 'note muted', hasAnyEntries ? 'no notes match your search.' : 'no notes yet.'));
    return;
  }
  for (const group of groupByDayAscending(entries).reverse()) {
    const day = el('li', 'note day-node');
    day.append(
      link(dayKey(group.day), 'link day-link', () => openDay(group.day)),
      el('span', 'muted', ` ${weekday(group.day).slice(0, 3)}`),
    );
    const nested = el('ul', 'notes nested');
    for (const entry of group.entries) {
      const item = el('li', 'note');
      item.append(el('span', 'note-time', clock(entry.createdAt)), el('span', 'note-dash', ' - '), el('span', 'note-text', entry.text));
      const title = thingTitles.get(entry.thingId);
      if (title) item.append(' ', link(title, 'link', () => openThing(entry.thingId)));
      nested.appendChild(item);
    }
    day.appendChild(nested);
    listEl.appendChild(day);
  }
}

export async function initReviewView(store, root, actions) {
  const searchInput = root.querySelector('#search-input');
  const rangeSelect = root.querySelector('#range-select');
  const listEl = root.querySelector('#entry-list');

  let allEntries = [];
  let thingTitles = new Map();

  function applyFilters() {
    const byRange = filterByDateRange(allEntries, rangeSelect.value);
    const bySearch = searchEntries(byRange, searchInput.value);
    renderResults(listEl, bySearch, allEntries.length > 0, thingTitles, actions);
  }

  async function refresh() {
    allEntries = await store.getAllEntries();
    thingTitles = new Map((await store.getAllThings()).map((t) => [t.id, t.title]));
    applyFilters();
  }

  searchInput.addEventListener('input', applyFilters);
  rangeSelect.addEventListener('change', applyFilters);

  await refresh();
  return { refresh, focus: () => searchInput.focus() };
}
