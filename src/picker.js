import { matchThings } from './things.js';

export function initPicker(root, { getThings, onPick, onCreate }) {
  const input = root.querySelector('#picker-input');
  const list = root.querySelector('#picker-list');
  let options = [];
  let selected = 0;

  function render() {
    list.innerHTML = '';
    options.forEach((option, index) => {
      const item = document.createElement('li');
      item.textContent = option.label;
      if (index === selected) item.className = 'selected';
      item.addEventListener('mousedown', (event) => {
        event.preventDefault();
        choose(option);
      });
      list.appendChild(item);
    });
  }

  function update() {
    const query = input.value.trim();
    options = matchThings(getThings(), query).map((t) => ({ label: t.title, id: t.id }));
    const exact = options.some((o) => o.label.toLowerCase() === query.toLowerCase());
    if (query && !exact) options.push({ label: `+ New thing: ${query}`, create: query });
    selected = Math.min(selected, Math.max(options.length - 1, 0));
    render();
  }

  function choose(option) {
    close();
    if (option.create) onCreate(option.create);
    else onPick(option.id);
  }

  function open() {
    root.hidden = false;
    input.value = '';
    selected = 0;
    update();
    input.focus();
  }

  function close() {
    root.hidden = true;
  }

  input.addEventListener('input', () => { selected = 0; update(); });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
    else if (event.key === 'ArrowDown') { event.preventDefault(); selected = Math.min(selected + 1, options.length - 1); render(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); selected = Math.max(selected - 1, 0); render(); }
    else if (event.key === 'Enter' && options[selected]) { event.preventDefault(); choose(options[selected]); }
  });
  root.addEventListener('mousedown', (event) => { if (event.target === root) close(); });

  return { open, close, isOpen: () => !root.hidden };
}
