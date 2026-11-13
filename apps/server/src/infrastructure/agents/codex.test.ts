import { readFileSync } from 'node:fs';
import type { ChatEvent } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import type { AgentSink, UsageReading } from '../../domain/agent.js';
import { mapCodexLine, newCodexState } from './codexMap.js';

const fixture = (name: string): string[] =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
    .split(String.fromCharCode(10))
    .filter((line) => line.trim() !== '');

function run(lines: string[]) {
  const events: ChatEvent[] = [];
  const chats: string[] = [];
  const usage: UsageReading[] = [];
  const sink: AgentSink = {
    event: (e) => events.push(e),
    delta: () => undefined,
    model: () => undefined,
    chatId: (id) => chats.push(id),
    usage: (u) => usage.push(u),
    ended: () => undefined,
  };
  const state = newCodexState();
  for (const line of lines) mapCodexLine(JSON.parse(line) as Record<string, unknown>, state, sink);
  return { events, chats, state, usage };
}

describe('Codex exec events as chat steps', () => {
  it("shows Codex's checklist as a TodoWrite step updated in place", () => {
    const { events } = run([
      '{"type":"item.started","item":{"id":"t1","type":"todo_list","items":[{"text":"read","completed":false},{"text":"fix","completed":false}]}}',
      '{"type":"item.updated","item":{"id":"t1","type":"todo_list","items":[{"text":"read","completed":true},{"text":"fix","completed":false}]}}',
      '{"type":"item.completed","item":{"id":"t1","type":"todo_list","items":[{"text":"read","completed":true},{"text":"fix","completed":true}]}}',
    ]);
    expect(events.map((e) => e.t)).toEqual(['tool', 'tool', 'tool', 'tool-result']);
    expect(events[0]).toEqual({
      t: 'tool',
      id: 't1',
      name: 'TodoWrite',
      input: {
        todos: [
          { content: 'read', status: 'pending' },
          { content: 'fix', status: 'pending' },
        ],
      },
    });
    expect(events[2]).toMatchObject({
      input: { todos: [{ status: 'completed' }, { status: 'completed' }] },
    });
  });

  it('maps a whole turn: thread, reasoning, a command, a patch, the answer', () => {
    const { events, chats } = run([
      '{"type":"thread.started","thread_id":"th-1"}',
      '{"type":"turn.started"}',
      '{"type":"item.completed","item":{"id":"i0","type":"reasoning","text":"Plan it"}}',
      '{"type":"item.started","item":{"id":"i1","type":"command_execution","command":"npm test","aggregated_output":"","exit_code":null,"status":"in_progress"}}',
      '{"type":"item.completed","item":{"id":"i1","type":"command_execution","command":"npm test","aggregated_output":"3 failed","exit_code":1,"status":"failed"}}',
      '{"type":"item.completed","item":{"id":"i2","type":"file_change","changes":[{"path":"a.ts","kind":"update"}],"status":"completed"}}',
      '{"type":"item.completed","item":{"id":"i3","type":"agent_message","text":"All fixed."}}',
      '{"type":"turn.completed","usage":{"input_tokens":1}}',
    ]);
    expect(chats).toEqual(['th-1']);
    expect(events).toEqual([
      { t: 'thinking', id: 'i0', text: 'Plan it' },
      { t: 'tool', id: 'i1', name: 'shell', input: { command: 'npm test' } },
      { t: 'tool-result', id: 'i1', output: '3 failed', isError: true },
      {
        t: 'tool',
        id: 'i2',
        name: 'apply_patch',
        input: { changes: [{ path: 'a.ts', kind: 'update' }] },
      },
      { t: 'tool-result', id: 'i2', output: 'update a.ts', isError: false },
      { t: 'text', id: 'i3', text: 'All fixed.' },
      { t: 'turn-end', error: null, costUsd: null, durationMs: null },
    ]);
  });

  it('shows MCP and web search calls, and a failed turn with its message', () => {
    const { events, state } = run([
      '{"type":"item.started","item":{"id":"m1","type":"mcp_tool_call","server":"deck","tool":"title","arguments":{"t":"x"},"status":"in_progress"}}',
      '{"type":"item.completed","item":{"id":"m1","type":"mcp_tool_call","server":"deck","tool":"title","arguments":{"t":"x"},"result":{"content":[{"type":"text","text":"ok"}]},"status":"completed"}}',
      '{"type":"item.completed","item":{"id":"w1","type":"web_search","query":"vitest"}}',
      '{"type":"error","message":"Reconnecting..."}',
      '{"type":"turn.failed","error":{"message":"401 Unauthorized"}}',
    ]);
    expect(events[0]).toMatchObject({ t: 'tool', name: 'deck.title' });
    expect(events[1]).toMatchObject({ t: 'tool-result', id: 'm1', isError: false });
    expect(events[2]).toMatchObject({ t: 'tool', name: 'web_search', input: { query: 'vitest' } });
    expect(events.at(-1)).toMatchObject({
      t: 'turn-end',
      error: expect.stringContaining('401 Unauthorized'),
    });
    expect(state.finished).toBe(true);
  });

  it('maps what Codex 0.167 really printed for a command and an answer', () => {
    const { events, chats, usage } = run(fixture('codex-0.167-command.jsonl'));
    expect(chats).toEqual(['th-real']);
    expect(events.map((e) => e.t)).toEqual(['tool', 'tool-result', 'text', 'turn-end']);
    expect(events[0]).toMatchObject({ t: 'tool', id: 'item_0', name: 'shell' });
    expect(events[1]).toMatchObject({
      t: 'tool-result',
      output: 'hi' + String.fromCharCode(13, 10),
      isError: false,
    });
    expect(events[2]).toMatchObject({ t: 'text', text: 'pong' });
    expect(usage).toEqual([{ contextTokens: 39_234 }]);
  });

  it('turns what Codex 0.167 printed without a login into one friendly error, without the retry noise', () => {
    const { events, state } = run(fixture('codex-0.167-not-signed-in.jsonl'));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      t: 'turn-end',
      error: expect.stringContaining('set a key for this profile'),
    });
    expect(events[0]).toMatchObject({ error: expect.stringContaining('401 Unauthorized') });
    expect(state.finished).toBe(true);
  });

  it('ignores lines it does not know', () => {
    const { events } = run([
      '{"type":"future.event","x":1}',
      '{"type":"item.completed","item":{"id":"z","type":"something_new","items":[]}}',
    ]);
    expect(events).toEqual([]);
  });
});
