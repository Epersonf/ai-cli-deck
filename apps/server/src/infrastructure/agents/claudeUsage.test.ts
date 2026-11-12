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
    expect(usage).toEqual([{ contextTokens: 1150 }, { costUsd: 0.21, contextWindow: 200_000 }]);
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
          used: 0.91,
          resetsAt: new Date(1_900_000_000_000).toISOString(),
          label: '5-hour limit',
        },
      },
      { limit: { used: 1, resetsAt: null, label: 'Weekly limit' } },
    ]);
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
