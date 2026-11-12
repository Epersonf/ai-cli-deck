import { describe, expect, it } from 'vitest';
import type { AgentSink } from '../../domain/agent.js';
import { mapClaudeMessage, newMapState } from './claudeMap.js';

describe('the model Claude says it uses', () => {
  it('is read from the start of a run and from each answer, but not the SDK notices', () => {
    const seen: string[] = [];
    const sink = {
      model: (m: string) => seen.push(m),
      chatId: () => undefined,
    } as unknown as AgentSink;
    const state = newMapState();
    mapClaudeMessage({ type: 'system', subtype: 'init', model: 'claude-opus-5' }, state, sink);
    mapClaudeMessage(
      { type: 'assistant', message: { model: 'claude-sonnet-5-5', content: [] } },
      state,
      {
        ...sink,
        event: () => undefined,
        usage: () => undefined,
      } as AgentSink,
    );
    mapClaudeMessage({ type: 'assistant', message: { model: '<synthetic>', content: [] } }, state, {
      ...sink,
      event: () => undefined,
      usage: () => undefined,
    } as AgentSink);
    expect(seen).toEqual(['claude-opus-5', 'claude-sonnet-5-5']);
  });
});
