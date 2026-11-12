import { describe, expect, it } from 'vitest';
import { runningCount, tasksFrom } from './tasks';

describe('chat tasks', () => {
  it('upserts by id and counts the running ones', () => {
    const tasks = tasksFrom([
      { t: 'task', id: 'a', title: 'npm run dev', state: 'running' },
      { t: 'task', id: 'b', title: 'build', state: 'running' },
      { t: 'task', id: 'b', title: 'build', state: 'done' },
    ]);
    expect(tasks.map((t) => [t.id, t.state])).toEqual([
      ['a', 'running'],
      ['b', 'done'],
    ]);
    expect(runningCount(tasks)).toBe(1);
  });
});
