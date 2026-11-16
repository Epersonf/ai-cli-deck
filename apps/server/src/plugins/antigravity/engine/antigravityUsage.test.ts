import { describe, expect, it } from 'vitest';
import { antigravityPromptUsage, antigravityUsageUpdate } from './antigravityUsage.js';

describe('antigravityUsage', () => {
  describe('antigravityUsageUpdate', () => {
    it('returns null for unrelated session updates', () => {
      expect(antigravityUsageUpdate({ sessionUpdate: 'agent_message_chunk' })).toBeNull();
      expect(antigravityUsageUpdate({})).toBeNull();
    });

    it('extracts context tokens, window size and cost', () => {
      const reading = antigravityUsageUpdate({
        sessionUpdate: 'usage_update',
        used: 8641,
        size: 1048576,
        cost: 0.02,
      });
      expect(reading).toEqual({
        contextTokens: 8641,
        contextWindow: 1048576,
        costUsd: 0.02,
      });
    });

    it('supports object-format cost structures', () => {
      const reading = antigravityUsageUpdate({
        sessionUpdate: 'usage_update',
        used: 500,
        cost: { amount: 0.015, currency: 'USD' },
      });
      expect(reading).toEqual({
        contextTokens: 500,
        costUsd: 0.015,
      });
    });
  });

  describe('antigravityPromptUsage', () => {
    it('returns null when usage payload is absent', () => {
      expect(antigravityPromptUsage(null, 'turn-1', Date.now())).toBeNull();
      expect(antigravityPromptUsage(undefined, 'turn-1', Date.now())).toBeNull();
    });

    it('maps ACP prompt result usage to turn and cache metrics', () => {
      const startedAt = Date.now() - 500;
      const reading = antigravityPromptUsage(
        {
          inputTokens: 1000,
          outputTokens: 150,
          thoughtTokens: 50,
          cachedReadTokens: 300,
          cachedWriteTokens: 50,
          totalTokens: 1200,
        },
        'turn-1',
        startedAt,
      );

      expect(reading).toMatchObject({
        contextTokens: 1200,
        turn: {
          id: 'turn-1',
          input: 1000,
          cached: 300,
          output: 200,
        },
        cache: {
          scope: 'turn',
          read: 300,
          write: 50,
          uncached: 700,
          ttlMs: null,
        },
      });
      expect(reading?.turn?.durationMs).toBeGreaterThanOrEqual(500);
    });
  });
});
