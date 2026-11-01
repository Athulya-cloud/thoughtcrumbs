export function buildEntry(text, createdAt, thingId = null) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return {
    id: crypto.randomUUID(),
    text: trimmed,
    createdAt,
    thingId,
  };
}
