import { randomUUID } from 'node:crypto';
import type { ApprovalDecision, ApprovalRequest } from '@deck/shared';
import type { EventBus } from '../domain/events.js';
import type { PhonePort } from '../domain/ports.js';
import type { ApprovalService } from './ApprovalService.js';

const TTL_MS = 30 * 60_000;

interface Pending {
  approvalId: string;
  decision: ApprovalDecision;
  expiresAt: number;
}

export interface ApprovalNotifierDeps {
  approvals: ApprovalService;
  bus: EventBus;
  phone: PhonePort | null;
  /** The terminals the person asked to be notified about (the watch behind "tell me when it goes quiet"). */
  watched(sessionId: string): boolean;
  /** What to call this terminal in the notification. */
  label(sessionId: string): string;
  /** Where the phone reaches this deck (loopback), without a trailing slash. */
  baseUrl: string;
  now(): number;
}

/**
 * Puts Approve / Reject on the phone's notification when an agent asks for a worktree. Each button carries its own
 * secret address that works once: whoever holds it (the phone bridge, never an agent) can decide that request.
 */
export class ApprovalNotifier {
  private readonly pending = new Map<string, Pending>();

  constructor(private readonly deps: ApprovalNotifierDeps) {}

  start(): void {
    this.deps.bus.subscribe((event) => {
      if (event.kind === 'approval' && event.request.status === 'pending') {
        void this.notify(event.request).catch(() => undefined);
      }
    });
  }

  /** Applies the decision behind a button; false when the address is unknown, used or too old. */
  async press(token: string): Promise<boolean> {
    const item = this.pending.get(token);
    if (!item || item.expiresAt < this.deps.now()) return false;
    for (const [key, other] of this.pending)
      if (other.approvalId === item.approvalId) this.pending.delete(key);
    await this.deps.approvals.decide(item.approvalId, item.decision);
    return true;
  }

  private async notify(request: ApprovalRequest): Promise<void> {
    const { phone } = this.deps;
    if (!phone || !this.deps.watched(request.sessionId)) return;
    const actions = (['approve', 'reject'] as const).map((decision) => {
      const token = randomUUID();
      this.pending.set(token, {
        approvalId: request.id,
        decision,
        expiresAt: this.deps.now() + TTL_MS,
      });
      return {
        label: decision === 'approve' ? 'Approve' : 'Reject',
        kind: decision === 'approve' ? 'yes' : 'no',
        url: `${this.deps.baseUrl}/agent/notify-action/${token}`,
      };
    });
    const who = this.deps.label(request.sessionId);
    await phone.request('POST', '/notify', {
      title: `${who} asks ${request.kind === 'folder' ? 'to change its folder' : 'for a worktree'}`,
      text:
        request.kind === 'folder'
          ? `${request.path ?? ''} ${request.reason}`.trim()
          : request.reason,
      actions,
    });
  }
}
