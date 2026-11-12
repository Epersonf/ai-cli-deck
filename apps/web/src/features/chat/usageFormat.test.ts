import { describe, expect, it } from 'vitest';
import { band, contextFill, tokens, untilReset } from './usageFormat';

const usage = {
  costUsd: null,
  contextTokens: 50_000,
  contextWindow: 200_000,
  limitUsed: null,
  limitResetsAt: null,
  limitLabel: null,
};

describe('usage format', () => {
  it('shortens token counts', () => {
    expect([tokens(950), tokens(12_345), tokens(250_000), tokens(1_200_000)]).toEqual([
      '950',
      '12.3k',
      '250k',
      '1.2M',
    ]);
  });

  it('computes the context fill, or null when unknown', () => {
    expect(contextFill(usage)).toBe(0.25);
    expect(contextFill({ ...usage, contextWindow: null })).toBeNull();
    expect(contextFill({ ...usage, contextTokens: 900_000 })).toBe(1);
  });

  it('says how long until the reset', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    expect(untilReset('2026-01-01T02:10:00Z', now)).toBe('2h 10m');
    expect(untilReset('2026-01-01T00:35:00Z', now)).toBe('35m');
    expect(untilReset('2025-12-31T00:00:00Z', now)).toBe('now');
  });

  it('bands the gauge', () => {
    expect([band(0.1), band(0.75), band(0.95)]).toEqual(['ok', 'warn', 'full']);
  });
});
