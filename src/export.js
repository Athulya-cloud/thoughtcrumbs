// Everything you wrote, as one file you keep. Browser storage can be wiped; this can't.

export function buildExport(things, entries, now = Date.now()) {
  return {
    app: 'Thoughtcrumbs',
    version: 1,
    exportedAt: new Date(now).toISOString(),
    things: things.slice().sort((a, b) => a.createdAt - b.createdAt),
    entries: entries.slice().sort((a, b) => a.createdAt - b.createdAt),
  };
}

export function exportFileName(now = Date.now()) {
  const d = new Date(now);
  const pad = (n) => String(n).padStart(2, '0');
  return `thoughtcrumbs-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}
