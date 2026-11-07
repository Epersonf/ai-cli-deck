import { describe, expect, it } from 'vitest';
import { sessionTime } from './sessionTime';

describe('sessionTime', () => {
  const now = new Date(2026, 10, 7, 18, 0);

  it('shows only the clock for a session from today', () => {
    const text = sessionTime(new Date(2026, 10, 7, 9, 5).toISOString(), now);
    expect(text).toMatch(/^\d{1,2}[:.]05/);
    expect(text).not.toContain('/');
  });

  it('adds the day for an older session', () => {
    const text = sessionTime(new Date(2026, 10, 5, 9, 5).toISOString(), now);
    expect(text.length).toBeGreaterThan(6);
  });

  it('is empty for an invalid date', () => {
    expect(sessionTime('nope', now)).toBe('');
  });
});
