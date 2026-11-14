import type { ChatUsage } from '@deck/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { retryPlan } from './retryPlan.js';
const now = Date.parse('2026-01-01T00:00:00Z');
const usage: ChatUsage = {
  contextTokens: null,
  contextWindow: null,
  costUsd: null,
  cache: null,
  limits: [],
};
afterEach(() => vi.restoreAllMocks());
describe('when to resume a limited task', () => {
  it('waits until every applicable exhausted window has reset', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const plan = retryPlan(
      { kind: 'usage', retryAt: '2026-01-01T01:00:00Z' },
      {
        ...usage,
        limits: [
          { key: 'seven_day', label: null, used: 1, resetsAt: '2026-01-02T00:00:00Z' },
          { key: 'seven_day_opus', label: null, used: 1, resetsAt: '2026-01-03T00:00:00Z' },
        ],
      },
      0,
      now,
      'sonnet',
    );
    expect(plan).toEqual({ estimated: false, retryAt: '2026-01-02T00:00:01.500Z' });
  });
  it('uses bounded backoff when the provider gives no reset time', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(retryPlan({ kind: 'rate', retryAt: null }, usage, 0, now, null)).toEqual({
      estimated: true,
      retryAt: '2026-01-01T00:01:00.000Z',
    });
    expect(retryPlan({ kind: 'rate', retryAt: null }, usage, 5, now, null).retryAt).toBe(
      '2026-01-01T00:15:00.000Z',
    );
  });
});
