// A small static graph: the open page in the middle, the pages it links to around it.

const NS = 'http://www.w3.org/2000/svg';
const WIDTH = 240;
const HEIGHT = 190;

function svg(tag, attrs) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

function shorten(text, max = 14) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function renderGraph(root, { center, nodes }) {
  root.innerHTML = '';
  const label = document.createElement('p');
  label.className = 'side-label';
  label.textContent = 'Linked';
  root.appendChild(label);

  const cx = WIDTH / 2;
  const cy = HEIGHT / 2 - 6;
  const art = svg('svg', { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, class: 'graph-art', role: 'group', 'aria-label': `Pages linked to ${center}` });
  const lines = svg('g', { class: 'graph-lines' });
  const dots = svg('g', {});
  art.append(lines, dots);

  const shown = nodes.slice(0, 8);
  shown.forEach((node, i) => {
    const angle = -Math.PI / 2 + 0.45 + (i * 2 * Math.PI) / shown.length;
    const radius = shown.length === 1 ? 52 : 44 + (i % 2) * 16;
    const x = cx + Math.cos(angle) * radius * 1.2;
    const y = cy + Math.sin(angle) * radius;
    lines.appendChild(svg('line', { x1: cx, y1: cy, x2: x, y2: y }));

    const g = svg('g', { class: 'graph-node', tabindex: '0', role: 'link', 'aria-label': node.label });
    const title = svg('title', {});
    title.textContent = node.label;
    const text = svg('text', { x, y: y + 15, 'text-anchor': 'middle' });
    text.textContent = shorten(node.label);
    g.append(title, svg('circle', { cx: x, cy: y, r: 3.5 }), text);
    g.addEventListener('click', node.onOpen);
    g.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        node.onOpen();
      }
    });
    dots.appendChild(g);
  });

  const middle = svg('g', { class: 'graph-center' });
  const title = svg('title', {});
  title.textContent = center;
  middle.append(title, svg('circle', { cx, cy, r: 5 }));
  dots.appendChild(middle);

  root.appendChild(art);
  if (shown.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'side-empty';
    empty.textContent = 'No links yet';
    root.appendChild(empty);
  }
}
