import { searchEntries, filterByDateRange } from './filters.js';
import { groupByDay } from './grouping.js';

function renderGroups(listEl, groups, hasAnyEntries, thingTitles) {
  listEl.innerHTML = '';

  if (groups.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = hasAnyEntries
      ? 'No entries match your search.'
      : 'No entries yet.';
    listEl.appendChild(empty);
    return;
  }

  for (const group of groups) {
    const heading = document.createElement('h3');
    heading.textContent = group.label;
    listEl.appendChild(heading);

    for (const entry of group.entries) {
      const item = document.createElement('div');
      item.className = 'entry';

      const time = document.createElement('span');
      time.className = 'entry-time';
      time.textContent = new Date(entry.createdAt).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });

      const text = document.createElement('p');
      text.className = 'entry-text';
      text.textContent = entry.text;

      item.append(time, text);
      const title = thingTitles.get(entry.thingId);
      if (title) {
        const label = document.createElement('span');
        label.className = 'entry-thing';
        label.textContent = title;
        item.appendChild(label);
      }
      listEl.appendChild(item);
    }
  }
}

export async function initReviewView(store, root) {
  const searchInput = root.querySelector('#search-input');
  const rangeSelect = root.querySelector('#range-select');
  const listEl = root.querySelector('#entry-list');

  let allEntries = [];
  let thingTitles = new Map();

  function applyFilters() {
    const byRange = filterByDateRange(allEntries, rangeSelect.value);
    const bySearch = searchEntries(byRange, searchInput.value);
    renderGroups(listEl, groupByDay(bySearch), allEntries.length > 0, thingTitles);
  }

  async function refresh() {
    allEntries = await store.getAllEntries();
    thingTitles = new Map((await store.getAllThings()).map((t) => [t.id, t.title]));
    applyFilters();
  }

  searchInput.addEventListener('input', applyFilters);
  rangeSelect.addEventListener('change', applyFilters);

  await refresh();
  return { refresh };
}
