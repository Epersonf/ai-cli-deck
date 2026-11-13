import { basename } from 'node:path';
import type { EventBus } from '../domain/events.js';
import type { PhonePort, SystemPort, WorktreePort } from '../domain/ports.js';
import { ActivityTracker } from './ActivityTracker.js';
import { ApprovalNotifier } from './ApprovalNotifier.js';
import { BrowserTabs } from './BrowserTabs.js';
import { ApprovalService } from './ApprovalService.js';
import type { AgentMemoryDeps } from './AgentMemory.js';
import { applyMemoryRequest } from './memoryApply.js';
import type { MemoryService } from './MemoryService.js';
import type { ProviderRegistry } from '../domain/provider.js';
import { ReplyLinks } from './ReplyLinks.js';
import { TurnNotifier } from './TurnNotifier.js';
import type { SessionManager } from './SessionManager.js';

/** What reaches the person without asking: activity of the chats, approvals, finished answers and approvals on every device, and Approve / Reject on the phone notification. */
export function liveServices(deps: {
  worktrees: WorktreePort;
  system: SystemPort;
  sessions: SessionManager;
  bus: EventBus;
  phone: PhonePort | null;
  port: number;
  memory: MemoryService;
  providers: ProviderRegistry;
}): {
  approvals: ApprovalService;
  approvalNotifier: ApprovalNotifier;
  replyLinks: ReplyLinks;
  activity: ActivityTracker;
  browserTabs: BrowserTabs;
  memoryAccess: AgentMemoryDeps;
} {
  const approvals = new ApprovalService({
    sessions: deps.sessions,
    worktrees: deps.worktrees,
    system: deps.system,
    bus: deps.bus,
    memory: { apply: (request) => applyMemoryRequest(deps.memory, request) },
  });
  const label = (id: string): string => {
    const session = deps.sessions.get(id);
    return session?.name ?? basename(session?.cwd ?? id);
  };
  const replyLinks = new ReplyLinks();
  new TurnNotifier({
    bus: deps.bus,
    phone: deps.phone,
    label,
    replyUrl: (id) => `http://127.0.0.1:${deps.port}/agent/reply/${replyLinks.issue(id)}`,
  }).start();
  const notifier = new ApprovalNotifier({
    approvals,
    bus: deps.bus,
    phone: deps.phone,
    label,
    baseUrl: `http://127.0.0.1:${deps.port}`,
    now: () => Date.now(),
  });
  notifier.start();
  const activity = new ActivityTracker(deps.bus);
  activity.start();
  const memoryAccess: AgentMemoryDeps = {
    memory: deps.memory,
    approvals,
    providers: deps.providers,
    profileOf: (id) => deps.sessions.get(id)?.provider ?? '',
    notice: (id, text) => deps.sessions.notice(id, text),
  };
  return {
    approvals,
    approvalNotifier: notifier,
    replyLinks,
    activity,
    browserTabs: new BrowserTabs(),
    memoryAccess,
  };
}
