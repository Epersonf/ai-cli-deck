import { TaskService } from '../application/TaskService.js';
import { createHarness } from './harness.js';

/** A task service wired to fakes: a phone that records what it is asked, a controllable clock and battery. */
export function setupTasks() {
  const h = createHarness();
  const sent: Array<[string, string, unknown]> = [];
  let battery = { percent: 50 };
  let clock = 1_000_000;
  const phone = {
    request: (method: 'GET' | 'POST', path: string, body?: unknown) => {
      sent.push([method, path, body]);
      return Promise.resolve(path === '/battery' ? battery : { shown: true });
    },
  };
  const tasks = new TaskService({
    sessions: h.sessions,
    bus: h.bus,
    phone,
    pty: h.ptyPort,
    envFor: () => ({ FROM: 'profile' }),
    shell: (line) => ({ command: 'sh', args: ['-c', line] }),
    now: () => clock,
    newId: (() => {
      let n = 0;
      return () => `t${++n}`;
    })(),
  });
  tasks.start();
  return {
    h,
    tasks,
    sent,
    setBattery: (percent: number) => (battery = { percent }),
    advance: (ms: number) => (clock += ms),
    at: () => clock,
  };
}
