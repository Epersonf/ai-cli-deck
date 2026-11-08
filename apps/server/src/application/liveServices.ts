import { basename } from 'node:path';
import type { EventBus } from '../domain/events.js';
import type { PhonePort, SystemPort, WorktreePort } from '../domain/ports.js';
import { ActivityTracker } from './ActivityTracker.js';
import { ApprovalNotifier } from './ApprovalNotifier.js';
import { BrowserTabs } from './BrowserTabs.js';
import { ApprovalService } from './ApprovalService.js';
import type { SessionManager } from './SessionManager.js';
import type { TaskService } from './TaskService.js';

/** What reaches the person without asking: activity of the terminals, approvals, and Approve / Reject on the phone notification for the terminals the person asked to be notified about. */
export function liveServices(deps: {
  worktrees: WorktreePort;
  system: SystemPort;
  sessions: SessionManager;
  tasks: TaskService;
  bus: EventBus;
  phone: PhonePort | null;
  port: number;
}): {
  approvals: ApprovalService;
  approvalNotifier: ApprovalNotifier;
  activity: ActivityTracker;
  browserTabs: BrowserTabs;
} {
  const approvals = new ApprovalService({
    sessions: deps.sessions,
    worktrees: deps.worktrees,
    system: deps.system,
    bus: deps.bus,
  });
  const notifier = new ApprovalNotifier({
    approvals,
    bus: deps.bus,
    phone: deps.phone,
    watched: (id) => deps.tasks.idleFor(id) !== undefined,
    label: (id) => {
      const session = deps.sessions.get(id);
      return session?.name ?? basename(session?.cwd ?? id);
    },
    baseUrl: `http://127.0.0.1:${deps.port}`,
    now: () => Date.now(),
  });
  notifier.start();
  const activity = new ActivityTracker(
    deps.bus,
    (id) => deps.sessions.replay(id),
    () => Date.now(),
  );
  activity.start();
  return { approvals, approvalNotifier: notifier, activity, browserTabs: new BrowserTabs() };
}
