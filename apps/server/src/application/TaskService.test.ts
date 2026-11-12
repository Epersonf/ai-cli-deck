import { describe, expect, it } from 'vitest';
import { agentBody } from '../testing/harness.js';
import { setupTasks as setup } from '../testing/taskKit.js';

describe('background tasks', () => {
  it('runs a command in the terminal folder with its profile environment, keeps its output and its exit', async () => {
    const { h, tasks } = setup();
    const owner = await h.sessions.create(agentBody('/work'));
    const task = tasks.runProcess(owner, 'npm run dev', 'dev server');
    const spawned = h.processes.spawned.at(-1);
    expect(spawned?.spec).toMatchObject({
      command: 'sh',
      args: ['-c', 'npm run dev'],
      cwd: '/work',
    });
    expect(spawned?.spec.env).toEqual({ FROM: 'profile' });
    spawned?.print('\x1b[32mlistening\x1b[0m on 3000\n\x1b]0;title\x07');
    expect(tasks.log(task.id)).toBe('listening on 3000\n'); // colors and window titles are dropped
    spawned?.finish(1);
    expect(tasks.board.list()[0]).toMatchObject({
      name: 'dev server',
      status: 'failed',
      detail: 'exit 1',
    });
  });

  it('a stopped task stays stopped when its process then exits', async () => {
    const { h, tasks } = setup();
    const owner = await h.sessions.create(agentBody());
    const task = tasks.runProcess(owner, 'sleep 99');
    tasks.board.stop(task.id);
    h.processes.spawned.at(-1)?.finish(143);
    expect(tasks.board.list()[0]?.status).toBe('stopped');
  });

  it('only lets a profile see and stop its own tasks', async () => {
    const { h, tasks } = setup();
    const mine = await h.sessions.create({ ...agentBody(), provider: 'claude' });
    const theirs = await h.sessions.create({ ...agentBody(), provider: 'codex' });
    const task = tasks.runProcess(mine, 'ls');
    expect(tasks.board.list('claude')).toHaveLength(1);
    expect(tasks.board.list(theirs.provider)).toEqual([]);
    expect(() => tasks.board.stop(task.id, theirs.provider)).toThrow(/not found/);
    expect(() => tasks.log(task.id, theirs.provider)).toThrow(/not found/);
  });
});
