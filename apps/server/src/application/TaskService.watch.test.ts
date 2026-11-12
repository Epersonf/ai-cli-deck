import { describe, expect, it } from 'vitest';
import { createHarness, agentBody } from '../testing/harness.js';
import { setupTasks as setup } from '../testing/taskKit.js';
import { TaskService } from './TaskService.js';

describe('background watchers', () => {
  it('watchers need the phone; without it they refuse', async () => {
    const h = createHarness();
    const tasks = new TaskService({
      sessions: h.sessions,
      bus: h.bus,
      phone: null,
      processes: h.processes,
      envFor: () => ({}),
      shell: (l) => ({ command: 'sh', args: ['-c', l] }),
      now: () => 0,
      newId: () => 'x',
    });
    const owner = await h.sessions.create(agentBody());
    expect(() => tasks.watchBattery(owner, { below: 10 })).toThrow(/Phone access is off/);
  });

  it('notifies once when the battery reaches the level, then is done', async () => {
    const { h, tasks, sent, setBattery, advance, at } = setup();
    const owner = await h.sessions.create(agentBody());
    const task = tasks.watchBattery(owner, { below: 10 });
    await tasks.poll(at());
    expect(sent.filter(([, p]) => p === '/notify')).toEqual([]);
    setBattery(9);
    advance(30_000);
    await tasks.poll(at());
    expect(sent.at(-1)).toEqual([
      'POST',
      '/notify',
      { title: 'Battery', text: 'Battery at 9% (at or below 10%)' },
    ]);
    expect(tasks.board.list()[0]).toMatchObject({ id: task.id, status: 'done' });
    advance(30_000);
    await tasks.poll(at());
    expect(sent.filter(([, p]) => p === '/notify')).toHaveLength(1);
  });
});
