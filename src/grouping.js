function startOfDay(timestamp) {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function groupByDay(entries, now = Date.now()) {
  const today = startOfDay(now);
  const yesterday = today - 24 * 60 * 60 * 1000;

  const order = [];
  const groups = new Map();

  for (const entry of entries) {
    const day = startOfDay(entry.createdAt);
    let label;
    if (day === today) label = 'Today';
    else if (day === yesterday) label = 'Yesterday';
    else {
      label = new Date(entry.createdAt).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }

    if (!groups.has(label)) {
      groups.set(label, []);
      order.push(label);
    }
    groups.get(label).push(entry);
  }

  return order.map((label) => ({ label, entries: groups.get(label) }));
}
