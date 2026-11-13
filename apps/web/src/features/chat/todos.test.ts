import { describe, expect, it } from 'vitest';
import type { Block } from './blocks';
import { doneCount, todosOf } from './todos';

const tool = (id: string, name: string, input: unknown): Block => ({
  kind: 'tool',
  id,
  name,
  input,
  result: null,
});

describe('the agent checklist', () => {
  it('reads Claude TodoWrite items and their states', () => {
    const todos = todosOf([
      tool('1', 'TodoWrite', {
        todos: [
          { content: 'read', status: 'completed', activeForm: 'Reading' },
          { content: 'fix', status: 'in_progress' },
          { content: 'test', status: 'pending' },
        ],
      }),
    ]);
    expect(todos).toEqual([
      { text: 'read', state: 'done' },
      { text: 'fix', state: 'active' },
      { text: 'test', state: 'pending' },
    ]);
    expect(doneCount(todos)).toBe(1);
  });

  it('reads other agents that call the text `text` or `step`, or use a completed flag', () => {
    expect(
      todosOf([
        tool('1', 'update_plan', { todos: [{ text: 'a', completed: true }, { step: 'b' }] }),
      ]),
    ).toEqual([
      { text: 'a', state: 'done' },
      { text: 'b', state: 'pending' },
    ]);
  });

  it('uses the newest checklist and skips empty items and other tools', () => {
    const blocks = [
      tool('1', 'TodoWrite', { todos: [{ content: 'old', status: 'pending' }] }),
      tool('2', 'TodoWrite', { todos: [{ content: ' ', status: 'pending' }, { content: 'new' }] }),
      tool('3', 'Bash', { command: 'ls' }),
      { kind: 'text', id: 't', text: 'hi', streaming: false } as Block,
    ];
    expect(todosOf(blocks)).toEqual([{ text: 'new', state: 'pending' }]);
  });

  it('is empty without a checklist', () => {
    expect(todosOf([])).toEqual([]);
    expect(todosOf([tool('1', 'Bash', { command: 'ls' })])).toEqual([]);
    expect(todosOf([tool('1', 'TodoWrite', 'garbage')])).toEqual([]);
  });
});
