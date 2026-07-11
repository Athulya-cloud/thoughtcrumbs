import { describe, it, expect } from 'vitest';
import { buildEntry } from '../src/capture.js';

describe('buildEntry', () => {
  it('returns null for empty text', () => {
    expect(buildEntry('', 1000)).toBeNull();
  });

  it('returns null for whitespace-only text', () => {
    expect(buildEntry('   \n  ', 1000)).toBeNull();
  });

  it('builds an entry with trimmed text and given timestamp', () => {
    const entry = buildEntry('  hello world  ', 1000);
    expect(entry.text).toBe('hello world');
    expect(entry.createdAt).toBe(1000);
    expect(typeof entry.id).toBe('string');
    expect(entry.id.length).toBeGreaterThan(0);
  });

  it('generates a different id for each call', () => {
    const a = buildEntry('one', 1000);
    const b = buildEntry('two', 1000);
    expect(a.id).not.toBe(b.id);
  });
});
