import { describe, expect, it } from 'vitest';
import { retryClock } from './retryClock.js';
const at = (text: string, now = '2026-01-01T12:00:00Z') => {
  const result = retryClock(text, Date.parse(now));
  return Number.isFinite(result) ? new Date(result).toISOString() : null;
};
describe('explicit time zones in CLI reset messages', () => {
  it('reads local clocks only with the zone the provider explicitly names', () => {
    expect(at('resets 5pm (America/Sao_Paulo)')).toBe('2026-01-01T20:00:00.000Z');
    expect(at('resets 5pm')).toBeNull();
    expect(at('resets 5pm (unknown)')).toBeNull();
    expect(at('resets 25pm (UTC)')).toBeNull();
  });
  it('handles midnight and chooses the next occurrence if today has passed', () => {
    expect(at('resets 12am (UTC)')).toBe('2026-01-02T00:00:00.000Z');
    expect(at('resets 1:30am (America/New_York)', '2026-11-01T05:45:00Z')).toBe(
      '2026-11-01T06:30:00.000Z',
    );
  });
});
