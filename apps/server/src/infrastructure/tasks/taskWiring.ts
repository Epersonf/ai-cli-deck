import type { SessionLauncher } from '../../application/SessionLauncher.js';
import type { SessionManager } from '../../application/SessionManager.js';
import { TaskService } from '../../application/TaskService.js';
import type { EventBus } from '../../domain/events.js';
import type { PhonePort } from '../../domain/ports.js';
import { NodePtyAdapter } from '../pty/NodePtyAdapter.js';

interface Deps {
  sessions: SessionManager;
  launcher: SessionLauncher;
  bus: EventBus;
  phone: PhonePort | null;
  /** The platform's default shell program (cmd.exe on Windows). */
  shellName: string;
  newId(): string;
}

/** The background-task service, running commands through the platform's shell. */
export function createTaskService(deps: Deps): TaskService {
  const tasks = new TaskService({
    sessions: deps.sessions,
    bus: deps.bus,
    phone: deps.phone,
    pty: new NodePtyAdapter(),
    envFor: (session) => deps.launcher.envFor(session),
    shell: (line) =>
      process.platform === 'win32'
        ? { command: deps.shellName, args: ['/c', line] }
        : { command: process.env['SHELL'] || 'bash', args: ['-lc', line] },
    now: () => Date.now(),
    newId: deps.newId,
  });
  tasks.start();
  return tasks;
}
