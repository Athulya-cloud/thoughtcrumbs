import { monthGrid, dayKey, startOfDay } from './days.js';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function button(className, text, label) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = text;
  if (label) b.setAttribute('aria-label', label);
  return b;
}

// Month calendar: today boxed, the open day outlined, a dot under days with notes.
export function renderCalendar(root, { year, month, selected, marked, onPickDay, onMonth }) {
  root.innerHTML = '';
  const today = startOfDay(Date.now());

  const head = document.createElement('div');
  head.className = 'cal-head';
  const title = document.createElement('span');
  title.className = 'cal-title';
  title.textContent = new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  const nav = document.createElement('span');
  nav.className = 'cal-nav';
  const prev = button('cal-step', '‹', 'Previous month');
  const todayButton = button('cal-today', 'today');
  const next = button('cal-step', '›', 'Next month');
  prev.addEventListener('click', () => onMonth(-1));
  next.addEventListener('click', () => onMonth(1));
  todayButton.addEventListener('click', () => onPickDay(today));
  nav.append(prev, todayButton, next);
  head.append(title, nav);

  const grid = document.createElement('div');
  grid.className = 'cal-grid';
  for (const name of WEEKDAYS) {
    const cell = document.createElement('span');
    cell.className = 'cal-weekday';
    cell.textContent = name;
    grid.appendChild(cell);
  }
  for (const { day, inMonth } of monthGrid(year, month)) {
    const b = button('cal-day', String(new Date(day).getDate()), dayKey(day));
    if (!inMonth) b.classList.add('out');
    if (day === today) b.classList.add('today');
    if (day === selected) {
      b.classList.add('selected');
      b.setAttribute('aria-current', 'date');
    }
    if (marked.has(day)) b.classList.add('marked');
    b.addEventListener('click', () => onPickDay(day));
    grid.appendChild(b);
  }

  root.append(head, grid);
}
