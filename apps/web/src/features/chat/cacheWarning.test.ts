import { describe, expect, it } from 'vitest';
import type { ChatUsage } from '@deck/shared';
import { cacheWarning } from './cacheWarning';

const now = Date.parse('2026-11-15T12:00:00Z');
const usage = (ttlMs: number | null, age: number): ChatUsage => ({
  costUsd: null,
  contextTokens: 42000,
  contextWindow: 200000,
  limits: [],
  cache: { read: 40000, write: null, ttlMs, at: new Date(now - age).toISOString() },
});

describe('send warning about cache reuse', () => {
  it('uses provider-reported lifetime and current context, never cumulative input', () => {
    const u = usage(300000, 300000);
    u.history = {
      turns: 10,
      input: 900000,
      cached: 800000,
      output: 1000,
      durationMs: 100,
      recent: [],
    };
    expect(cacheWarning(u, 'claude', false, now)).toEqual({ estimated: false, tokens: 42000 });
    expect(cacheWarning(usage(300000, 299999), 'claude', false, now)).toBeNull();
  });
  it('labels unknown Codex retention as a risk after an hour, not confirmed expiry', () => {
    expect(cacheWarning(usage(null, 3600000), 'codex', false, now)).toEqual({
      estimated: true,
      tokens: 42000,
    });
    expect(cacheWarning(usage(null, 3599999), 'codex', false, now)).toBeNull();
    expect(cacheWarning(usage(null, 7200000), 'openai', false, now)).toBeNull();
  });
  it('does not interrupt active work or invent measurements', () => {
    expect(cacheWarning(usage(300000, 600000), 'claude', true, now)).toBeNull();
    expect(cacheWarning(null, 'codex', false, now)).toBeNull();
    const u = usage(300000, 600000);
    u.contextTokens = null;
    expect(cacheWarning(u, 'claude', false, now)?.tokens).toBeNull();
    if (u.cache) u.cache.at = 'invalid';
    expect(cacheWarning(u, 'codex', false, now)).toBeNull();
  });
});
