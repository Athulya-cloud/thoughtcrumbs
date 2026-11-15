import { searchEntries, filterByDateRange } from './filters.js';
import { groupByDayAscending, clock, dayHeading } from './days.js';

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
    listEl.appendChild(el('p', 'empty', hasAnyEntries ? 'No notes match your search.' : 'No notes yet.'));
    return;
  }
  for (const group of groupByDayAscending(entries).reverse()) {
    const section = el('section', 'day-group');
    const heading = el('h3', 'day-heading');
    heading.appendChild(link(dayHeading(group.day), 'day-link', () => openDay(group.day)));
    const list = el('ul', 'notes');
    for (const entry of group.entries) {
      const item = el('li', 'note');
      const body = el('div', 'note-body');
      body.appendChild(el('span', 'note-text', entry.text));
      const title = thingTitles.get(entry.thingId);
      if (title) body.append(' ', link(title, 'chip', () => openThing(entry.thingId)));
      item.append(el('span', 'note-time', clock(entry.createdAt)), body);
      list.appendChild(item);
    }
    section.append(heading, list);
    listEl.appendChild(section);
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
