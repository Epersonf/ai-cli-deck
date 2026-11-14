import type { ChatEvent } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { applyDelta, applyEvent, fromReplay, type Block } from './blocks';

const fold = (events: ChatEvent[], from: Block[] = []): Block[] => events.reduce(applyEvent, from);

describe('chat blocks', () => {
  it('keeps replies and tool results in their own turns when Codex reuses item ids', () => {
    const events: ChatEvent[] = [
      { t: 'user', id: 'u1', text: 'first question', attachments: [], at: '' },
      { t: 'turn-start' },
      { t: 'text', id: 'item_0', text: 'first answer' },
      { t: 'tool', id: 'item_1', name: 'shell', input: { command: 'first' } },
      { t: 'tool-result', id: 'item_1', output: 'first result', isError: false },
      { t: 'turn-end', error: null, costUsd: null, durationMs: null },
      { t: 'user', id: 'u2', text: 'second question', attachments: [], at: '' },
      { t: 'turn-start' },
      { t: 'text', id: 'item_0', text: 'second answer' },
      { t: 'tool', id: 'item_1', name: 'shell', input: { command: 'second' } },
      { t: 'tool-result', id: 'item_1', output: 'second result', isError: false },
      { t: 'turn-end', error: null, costUsd: null, durationMs: null },
    ];
    for (const blocks of [fold(events), fromReplay(events, [])]) {
      expect(
        blocks.flatMap((b) => (b.kind === 'user' || b.kind === 'text' ? [b.text] : [])),
      ).toEqual(['first question', 'first answer', 'second question', 'second answer']);
      expect(blocks.filter((b) => b.kind === 'tool').map((b) => b.result?.output)).toEqual([
        'first result',
        'second result',
      ]);
      expect(new Set(blocks.map((b) => `${b.kind}-${b.id}`)).size).toBe(blocks.length);
    }
  });

  it('matches streamed text and replay partials to the current turn only', () => {
    const events: ChatEvent[] = [
      { t: 'text', id: 'item_0', text: 'first answer' },
      { t: 'turn-end', error: null, costUsd: null, durationMs: null },
      { t: 'turn-start' },
    ];
    const delta = { id: 'item_0', kind: 'text' as const, text: 'second' };
    for (const initial of [applyDelta(fold(events), delta), fromReplay(events, [delta])]) {
      const blocks = applyEvent(initial, { t: 'text', id: 'item_0', text: 'second answer' });
      expect(blocks.flatMap((b) => (b.kind === 'text' ? [b.text] : []))).toEqual([
        'first answer',
        'second answer',
      ]);
    }
  });

  it('pairs a tool with its result and a permission with its answer', () => {
    const blocks = fold([
      { t: 'tool', id: 't1', name: 'Bash', input: { command: 'ls' } },
      { t: 'permission', id: 'p1', tool: 'Bash', input: {}, canAlways: true, reason: null },
      { t: 'permission-done', id: 'p1', allowed: true },
      { t: 'tool-result', id: 't1', output: 'a.txt', isError: false },
    ]);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ kind: 'tool', result: { output: 'a.txt', isError: false } });
    expect(blocks[1]).toMatchObject({ kind: 'permission', state: 'allowed' });
  });

  it('ignores a result whose tool is unknown', () => {
    expect(fold([{ t: 'tool-result', id: 'nope', output: 'x', isError: false }])).toEqual([]);
  });

  it('streams text, then replaces it with the finished event', () => {
    let blocks = applyDelta([], { id: 'm1', kind: 'text', text: 'Hel' });
    blocks = applyDelta(blocks, { id: 'm1', kind: 'text', text: 'lo' });
    expect(blocks).toEqual([{ kind: 'text', id: 'm1', text: 'Hello', streaming: true }]);
    blocks = applyEvent(blocks, { t: 'text', id: 'm1', text: 'Hello!' });
    expect(blocks).toEqual([{ kind: 'text', id: 'm1', text: 'Hello!', streaming: false }]);
  });

  it('draws turn ends and notices as rows of their own', () => {
    const blocks = fold([
      { t: 'user', id: 'u', text: 'hi', attachments: [], at: '2026-01-01T00:00:00Z' },
      { t: 'notice', level: 'info', text: 'hello' },
      { t: 'turn-end', error: 'bad key', costUsd: null, durationMs: 1200 },
    ]);
    expect(blocks.map((b) => b.kind)).toEqual(['user', 'notice', 'turn']);
    expect(blocks[2]).toMatchObject({ error: 'bad key', durationMs: 1200 });
  });

  it('builds a replay with the unfinished text last', () => {
    const blocks = fromReplay(
      [{ t: 'text', id: 'a', text: 'done' }],
      [{ id: 'b', kind: 'thinking', text: 'hm' }],
    );
    expect(blocks.map((b) => [b.kind, b.id])).toEqual([
      ['text', 'a'],
      ['thinking', 'b'],
    ]);
  });
});
