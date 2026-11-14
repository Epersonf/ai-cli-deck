import { describe, expect, it } from 'vitest';
import { band, cacheLeft, cacheShare, contextFill, tokens, untilReset } from './usageFormat';

const usage = {
  costUsd: null,
  contextTokens: 50_000,
  contextWindow: 200_000,
  limits: [],
  cache: null,
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

  it('counts down the cache, and says nothing when its lifetime is unknown', () => {
    const at = '2026-01-01T00:00:00Z';
    const now = Date.parse(at);
    expect(cacheLeft({ read: 1, write: 0, ttlMs: 300_000, at }, now + 60_000)).toBe(240_000);
    expect(cacheLeft({ read: 1, write: 0, ttlMs: 300_000, at }, now + 400_000)).toBe(0);
    expect(cacheLeft({ read: 1, write: 0, ttlMs: null, at }, now)).toBeNull();
  });

  it('computes the share of the prompt read from the cache', () => {
    const at = '2026-01-01T00:00:00Z';
    expect(cacheShare({ read: 900, write: 100, ttlMs: null, at })).toBe(0.9);
    expect(cacheShare({ read: 0, write: 0, ttlMs: null, at })).toBeNull();
  });
});
