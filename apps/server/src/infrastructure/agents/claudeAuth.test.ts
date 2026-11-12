import type { ChatEvent } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import type { AgentSink } from '../../domain/agent.js';
import { isAuthFailure, markAuth } from '../../domain/authError.js';
import { mapClaudeMessage, newMapState, type SdkMessage } from './claudeMap.js';

function feed(...messages: SdkMessage[]): ChatEvent[] {
  const events: ChatEvent[] = [];
  const sink: AgentSink = {
    event: (e) => events.push(e),
    delta: () => undefined,
    model: () => undefined,
    chatId: () => undefined,
    usage: () => undefined,
    ended: () => undefined,
  };
  const state = newMapState();
  messages.forEach((m) => mapClaudeMessage(m, state, sink));
  return events;
}

const said = (text: string): SdkMessage => ({
  type: 'assistant',
  message: { id: 'm1', content: [{ type: 'text', text }] },
});

describe('a Claude turn that fails because of credentials', () => {
  it('ends with the AUTH marker and does not also show the CLI line as an answer', () => {
    const events = feed(said('Not logged in · Please run /login'), {
      type: 'result',
      subtype: 'success',
      is_error: true,
      result: 'Not logged in · Please run /login',
      total_cost_usd: 0,
    });
    expect(events).toEqual([
      {
        t: 'turn-end',
        error: 'AUTH: Not logged in · Please run /login',
        costUsd: 0,
        durationMs: null,
      },
    ]);
  });

  it('catches an invalid key, an authentication_failed message and a result alone', () => {
    const key = feed(said('Invalid API key · Please run /login'), {
      type: 'result',
      subtype: 'success',
    });
    expect(key).toHaveLength(1);
    expect(key[0]).toMatchObject({ error: 'AUTH: Invalid API key · Please run /login' });
    const flagged = feed(
      { type: 'assistant', error: 'authentication_failed', message: { id: 'm', content: [] } },
      { type: 'result', subtype: 'success', is_error: true },
    );
    expect(flagged[0]).toMatchObject({ error: expect.stringMatching(/^AUTH: /) });
    const alone = feed({
      type: 'result',
      subtype: 'error_during_execution',
      is_error: true,
      result: 'API Error: 401 Unauthorized',
    });
    expect(alone[0]).toMatchObject({ error: 'AUTH: API Error: 401 Unauthorized' });
  });

  it('leaves normal answers and other failures alone', () => {
    const events = feed(
      said('You can run /login yourself if you like, then we continue with the task.'),
      {
        type: 'result',
        subtype: 'error_max_turns',
        is_error: true,
        result: 'Too many turns',
      },
    );
    expect(events.map((e) => e.t)).toEqual(['text', 'turn-end']);
    expect(events[1]).toMatchObject({ error: 'Too many turns' });
  });

  it('marks once and only credential failures', () => {
    expect(markAuth('HTTP 401 from the gateway')).toBe('AUTH: HTTP 401 from the gateway');
    expect(markAuth('AUTH: already')).toBe('AUTH: already');
    expect(markAuth('Network down')).toBe('Network down');
    expect(isAuthFailure('Not logged in')).toBe(true);
  });
});
