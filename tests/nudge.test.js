import { describe, it, expect } from 'vitest';
import { shouldNudge, isQuietHour, NUDGE_INTERVAL_MS } from '../src/nudge.js';

const at = (h) => new Date(2026, 9, 31, h, 0).getTime();

describe('isQuietHour', () => {
  it('is quiet from 22:00 to 07:00', () => {
    expect(isQuietHour(new Date(2026, 9, 31, 22, 0))).toBe(true);
    expect(isQuietHour(new Date(2026, 9, 31, 3, 0))).toBe(true);
    expect(isQuietHour(new Date(2026, 9, 31, 7, 0))).toBe(false);
    expect(isQuietHour(new Date(2026, 9, 31, 21, 59))).toBe(false);
  });
});

describe('shouldNudge', () => {
  it('never nudges when switched off', () => {
    expect(shouldNudge({ now: at(14), enabled: false, lastNudgeAt: 0 })).toBe(false);
  });
  it('waits for the interval to pass', () => {
    expect(shouldNudge({ now: at(14), enabled: true, lastNudgeAt: at(14) - NUDGE_INTERVAL_MS + 1 })).toBe(false);
    expect(shouldNudge({ now: at(14), enabled: true, lastNudgeAt: at(14) - NUDGE_INTERVAL_MS })).toBe(true);
  });
  it('stays quiet overnight even when overdue', () => {
    expect(shouldNudge({ now: at(23), enabled: true, lastNudgeAt: 0 })).toBe(false);
  });
});
