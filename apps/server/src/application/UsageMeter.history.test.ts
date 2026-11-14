import { describe, expect, it } from 'vitest';
import { LimitBook } from './LimitBook.js';
import { UsageMeter } from './UsageMeter.js';
import type { UsageHistory } from '@deck/shared';

const turn = (id: string) => ({
  id,
  input: 1000,
  cached: 800,
  output: 100,
  durationMs: 500,
  at: '2026-11-14T12:00:00Z',
});

describe('usage across Codex turns', () => {
  it('separates totals from context and last-call cache, bounds history, and deduplicates a turn', () => {
    const meter = new UsageMeter(new LimitBook(), 'codex');
    for (let i = 0; i < 30; i++) meter.reading({ turn: turn(String(i)) });
    meter.reading({ turn: turn('29') });
    meter.reading({
      contextTokens: 300,
      cache: { read: 200, write: null, uncached: 100, ttlMs: null },
    });
    expect(meter.current()).toMatchObject({
      contextTokens: 300,
      cache: { read: 200 },
      history: {
        turns: 30,
        input: 30_000,
        cached: 24_000,
        output: 3000,
        durationMs: 15_000,
      },
    });
    expect(meter.current().history?.recent).toHaveLength(20);
    expect(meter.current().history?.recent[0]?.id).toBe('10');
    meter.reading({ compacted: true });
    expect(meter.current()).toMatchObject({
      contextTokens: null,
      cache: null,
      history: { turns: 30 },
    });
  });

  it('restores totals after restart and clears them for a new conversation', () => {
    let saved: UsageHistory | null = null;
    const store = {
      read: () => saved,
      write: (_id: string, history: UsageHistory | null) => {
        saved = history;
      },
      remove: () => {},
    };
    const first = new UsageMeter(new LimitBook(), 'codex', () => new Date(), {
      store,
      sessionId: 'a',
    });
    first.reading({ turn: turn('first') });
    const second = new UsageMeter(new LimitBook(), 'codex', () => new Date(), {
      store,
      sessionId: 'a',
    });
    second.reading({ turn: turn('second') });
    expect(second.current().history?.turns).toBe(2);
    second.reset();
    expect(second.current().history).toBeUndefined();
    expect(saved).toBeNull();
  });
});
