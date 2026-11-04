import { describe, expect, it } from 'vitest';
import { createHarness, customBody } from '../testing/harness.js';
import { setupTasks as setup } from '../testing/taskKit.js';
import { TaskService } from './TaskService.js';

describe('background watchers', () => {
  it('watchers need the phone; without it they refuse', async () => {
    const h = createHarness();
    const tasks = new TaskService({
      sessions: h.sessions,
      bus: h.bus,
      phone: null,
      pty: h.ptyPort,
      envFor: () => ({}),
      shell: (l) => ({ command: 'sh', args: ['-c', l] }),
      now: () => 0,
      newId: () => 'x',
    });
    const owner = await h.sessions.create(customBody());
    expect(() => tasks.watchBattery(owner, { below: 10 })).toThrow(/Phone access is off/);
    expect(() => tasks.watchIdle(owner)).toThrow(/Phone access is off/);
  });

  it('notifies once when the battery reaches the level, then is done', async () => {
    const { h, tasks, sent, setBattery, advance, at } = setup();
    const owner = await h.sessions.create(customBody());
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

  it('notifies when a terminal goes quiet after output, not for the echo of typing', async () => {
    const { h, tasks, sent, advance, at } = setup();
    const owner = await h.sessions.create({ ...customBody(), provider: 'claude', command: null });
    tasks.watchIdle(owner);
    const pty = h.ptyPort.spawned[0]?.pty;
    h.sessions.sendInput(owner.id, 'ls\r'); // the user types...
    pty?.emit('ls\r\n'); // ...and the terminal echoes it
    advance(31_000);
    await tasks.poll(at());
    expect(sent).toEqual([]);
    advance(5_000);
    pty?.emit('the agent answers'); // real output
    advance(10_000);
    await tasks.poll(at());
    expect(sent).toEqual([]); // not quiet long enough yet
    advance(25_000);
    await tasks.poll(at());
    expect(sent).toEqual([
      ['POST', '/notify', { title: 'CLI Deck', text: expect.stringContaining('is waiting') }],
    ]);
    advance(60_000);
    await tasks.poll(at());
    expect(sent).toHaveLength(1); // once per burst
  });

  it('one quiet-watcher per terminal, turned off from the menu, and tasks end with their terminal', async () => {
    const { h, tasks } = setup();
    const owner = await h.sessions.create(customBody());
    expect(tasks.watchIdle(owner).id).toBe(tasks.watchIdle(owner).id);
    expect(tasks.idleFor(owner.id)).toBeDefined();
    tasks.setIdle(owner, false);
    expect(tasks.idleFor(owner.id)).toBeUndefined();
    const again = tasks.setIdle(owner, true);
    await h.sessions.remove(owner.id);
    await tasks.poll();
    expect(tasks.board.list().find((t) => t.id === again?.id)).toMatchObject({
      status: 'stopped',
      detail: 'terminal ended',
    });
  });
});
