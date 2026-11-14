import type { ChatEvent } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import type { AgentSink, UsageReading } from '../../domain/agent.js';
import { mapClaudeMessage, newMapState, type SdkMessage } from './claudeMap.js';

function collect() {
  const events: ChatEvent[] = [];
  const usage: UsageReading[] = [];
  const sink: AgentSink = {
    event: (e) => events.push(e),
    delta: () => undefined,
    model: () => undefined,
    chatId: () => undefined,
    usage: (u) => usage.push(u),
    ended: () => undefined,
  };
  const state = newMapState();
  const feed = (...messages: SdkMessage[]) =>
    messages.forEach((m) => mapClaudeMessage(m, state, sink));
  return { events, usage, state, sink, feed };
}

describe('usage from Claude', () => {
  it('reads the context of each answer, and cost and window from the result', () => {
    const { usage, feed } = collect();
    feed(
      {
        type: 'assistant',
        message: {
          id: 'm1',
          content: [],
          usage: {
            input_tokens: 10,
            cache_read_input_tokens: 1000,
            cache_creation_input_tokens: 90,
            output_tokens: 50,
          },
        },
      },
      {
        type: 'result',
        subtype: 'success',
        total_cost_usd: 0.21,
        modelUsage: {
          'claude-sonnet': { contextWindow: 200_000 },
          'claude-haiku': { contextWindow: 100_000 },
        },
      },
    );
    expect(usage).toEqual([
      { contextTokens: 1150, cache: { read: 1000, write: 100, ttlMs: null } },
      { costUsd: 0.21, contextWindow: 200_000 },
    ]);
  });

  it('reads the account window from a rate limit event, and ignores one that says no amount', () => {
    const { usage, feed } = collect();
    feed(
      { type: 'rate_limit_event', rate_limit_info: { status: 'allowed' } },
      {
        type: 'rate_limit_event',
        rate_limit_info: {
          status: 'allowed_warning',
          rateLimitType: 'five_hour',
          utilization: 0.91,
          resetsAt: 1_900_000_000,
        },
      },
      {
        type: 'rate_limit_event',
        rate_limit_info: { status: 'rejected', rateLimitType: 'seven_day' },
      },
    );
    expect(usage).toEqual([
      {
        limit: {
          key: 'five_hour',
          used: 0.91,
          resetsAt: new Date(1_900_000_000_000).toISOString(),
          label: '5-hour limit',
        },
      },
      { limit: { key: 'seven_day', used: 1, resetsAt: null, label: 'Weekly limit' } },
    ]);
  });

  it('tells the cache lifetime from what an answer wrote, the hour one first', () => {
    const { usage, feed } = collect();
    const answer = (cache_creation: Record<string, number>): SdkMessage => ({
      type: 'assistant',
      message: {
        id: 'm',
        content: [],
        usage: { cache_creation_input_tokens: 10, cache_creation },
      },
    });
    feed(answer({ ephemeral_5m_input_tokens: 10 }), answer({ ephemeral_1h_input_tokens: 10 }));
    expect(usage.map((u) => u.cache?.ttlMs)).toEqual([300_000, 3_600_000]);
  });

  it('reports a compaction, with the context it left when the SDK says', () => {
    const { usage, feed } = collect();
    feed(
      { type: 'system', subtype: 'compact_boundary', compact_metadata: { post_tokens: 8000 } },
      { type: 'system', subtype: 'compact_boundary', compact_metadata: {} },
    );
    expect(usage).toEqual([{ compacted: true, contextTokens: 8000 }, { compacted: true }]);
  });

  it('leaves sub-agent answers out of the context figure', () => {
    const { usage, feed } = collect();
    feed({
      type: 'assistant',
      parent_tool_use_id: 'tool-1',
      message: { id: 'm', content: [], usage: { input_tokens: 5000 } },
    });
    expect(usage).toEqual([]);
  });
});

describe('the cache as other endpoints report it', () => {
  it('counts what was not read from it, which is all DeepSeek says besides its hits', () => {
    const { usage, feed } = collect();
    feed({
      type: 'assistant',
      message: {
        id: 'm',
        content: [],
        usage: {
          input_tokens: 300,
          cache_read_input_tokens: 9_000,
          cache_creation_input_tokens: 0,
        },
      },
    });
    expect(usage[0]?.cache).toEqual({ read: 9_000, write: 300, ttlMs: null });
  });
});
