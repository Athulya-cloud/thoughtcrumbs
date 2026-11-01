export const NUDGE_INTERVAL_MS = 60 * 60 * 1000;

export function isQuietHour(date) {
  const hour = date.getHours();
  return hour >= 22 || hour < 7;
}

export function shouldNudge({ now, enabled, lastNudgeAt, intervalMs = NUDGE_INTERVAL_MS }) {
  if (!enabled) return false;
  if (isQuietHour(new Date(now))) return false;
  return now - lastNudgeAt >= intervalMs;
}
