import type { ChatEvent } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import type { AgentSink } from '../../domain/agent.js';
import { mapClaudeMessage, newMapState, type SdkMessage } from './claudeMap.js';

function collect() {
  const events: ChatEvent[] = [];
  const deltas: Array<[string, string, string]> = [];
  const chats: string[] = [];
  const sink: AgentSink = {
    event: (e) => events.push(e),
    delta: (id, kind, text) => deltas.push([id, kind, text]),
    model: () => undefined,
    chatId: (id) => chats.push(id),
    usage: () => undefined,
    ended: () => undefined,
  };
  const state = newMapState();
  const feed = (...messages: SdkMessage[]) =>
    messages.forEach((m) => mapClaudeMessage(m, state, sink));
  return { events, deltas, chats, feed };
}

describe('Claude Agent SDK messages as chat steps', () => {
  it('streams text and thinking under the id the finished block will have', () => {
    const { deltas, events, feed } = collect();
    feed(
      { type: 'stream_event', event: { type: 'message_start', message: { id: 'msg1' } } },
      {
        type: 'stream_event',
        event: { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'Hi' } },
      },
      {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'thinking_delta', thinking: 'hm' },
        },
      },
      {
        type: 'assistant',
        message: {
          id: 'msg1',
          content: [
            { type: 'thinking', thinking: 'hmm' },
            { type: 'text', text: 'Hi there' },
          ],
        },
      },
    );
    expect(deltas).toEqual([
      ['msg1:1', 'text', 'Hi'],
      ['msg1:0', 'thinking', 'hm'],
    ]);
    expect(events).toEqual([
      { t: 'thinking', id: 'msg1:0', text: 'hmm' },
      { t: 'text', id: 'msg1:1', text: 'Hi there' },
    ]);
  });

  it('pairs a tool call with its result, text or structured, and keeps errors', () => {
    const { events, feed } = collect();
    feed(
      {
        type: 'assistant',
        message: {
          id: 'm',
          content: [{ type: 'tool_use', id: 'tu1', name: 'Bash', input: { command: 'ls' } }],
        },
      },
      {
        type: 'user',
        message: {
          content: [
            { type: 'tool_result', tool_use_id: 'tu1', content: [{ type: 'text', text: 'a\nb' }] },
            { type: 'tool_result', tool_use_id: 'tu2', content: 'boom', is_error: true },
          ],
        },
      },
    );
    expect(events).toEqual([
      { t: 'tool', id: 'tu1', name: 'Bash', input: { command: 'ls' } },
      { t: 'tool-result', id: 'tu1', output: 'a\nb', isError: false },
      { t: 'tool-result', id: 'tu2', output: 'boom', isError: true },
    ]);
  });

  it('reports the conversation id once, and ends the turn with cost or the failure', () => {
    const { events, chats, feed } = collect();
    feed(
      { type: 'system', subtype: 'init', session_id: 'c1' },
      { type: 'assistant', session_id: 'c1', message: { id: 'm', content: [] } },
      {
        type: 'result',
        subtype: 'success',
        session_id: 'c1',
        total_cost_usd: 0.02,
        duration_ms: 1200,
      },
      { type: 'result', subtype: 'error_during_execution', is_error: true, errors: ['No key'] },
    );
    expect(chats).toEqual(['c1']);
    expect(events).toEqual([
      { t: 'turn-end', error: null, costUsd: 0.02, durationMs: 1200 },
      { t: 'turn-end', error: 'No key', costUsd: null, durationMs: null },
    ]);
  });

  it('ignores what sub-agents do inside a tool, and empty blocks', () => {
    const { events, feed } = collect();
    feed(
      {
        type: 'assistant',
        parent_tool_use_id: 'task1',
        message: { id: 'm', content: [{ type: 'text', text: 'inner' }] },
      },
      { type: 'assistant', message: { id: 'n', content: [{ type: 'text', text: '  ' }] } },
    );
    expect(events).toEqual([]);
  });
});
