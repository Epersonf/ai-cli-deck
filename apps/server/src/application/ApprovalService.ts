import type { ApprovalDecision, ApprovalRequest, Session } from '@deck/shared';
import { conflict, forbidden, notFound } from '../domain/errors.js';
import type { EventBus } from '../domain/events.js';
import type { SystemPort, WorktreePort } from '../domain/ports.js';

export interface SessionDirectory {
  get(id: string): Session | undefined;
  applyWorktree(id: string, path: string, branch: string): void;
}

export interface ApprovalDeps {
  sessions: SessionDirectory;
  worktrees: WorktreePort;
  system: SystemPort;
  bus: EventBus;
}

/** Siblings of the repo folder, so the worktree never nests inside the repo it came from. */
export function worktreePathFor(cwd: string, sessionId: string): string {
  const trimmed = cwd.replace(/[\\/]+$/, '');
  return `${trimmed}-deck-${sessionId}`;
}

/**
 * Agents may only PROPOSE a worktree. The single code path that creates one is `decide`
 * with an `approve` decision on a pending request.
 */
export class ApprovalService {
  private readonly requests = new Map<string, ApprovalRequest>();

  constructor(private readonly deps: ApprovalDeps) {}

  propose(sessionId: string, reason: string): ApprovalRequest {
    const session = this.deps.sessions.get(sessionId);
    if (!session) throw notFound(`Session ${sessionId}`);
    if (!session.worktree.enabled) throw forbidden('Worktrees are disabled for this session');
    if (session.worktree.path !== null) throw conflict('Session already has a worktree');
    const pending = this.list('pending').find((r) => r.sessionId === sessionId);
    if (pending) return pending;
    const request: ApprovalRequest = {
      id: this.deps.system.newId(),
      sessionId,
      kind: 'worktree',
      reason,
      status: 'pending',
      createdAt: this.deps.system.now().toISOString(),
      resultPath: null,
    };
    this.save(request);
    return request;
  }

  get(id: string): ApprovalRequest {
    const request = this.requests.get(id);
    if (!request) throw notFound(`Request ${id}`);
    return request;
  }

  list(status?: ApprovalRequest['status']): ApprovalRequest[] {
    const all = [...this.requests.values()];
    return status ? all.filter((r) => r.status === status) : all;
  }

  async decide(id: string, decision: ApprovalDecision): Promise<ApprovalRequest> {
    const request = this.get(id);
    if (request.status !== 'pending') throw conflict(`Request already ${request.status}`);
    if (decision === 'reject') return this.save({ ...request, status: 'rejected' });
    const session = this.deps.sessions.get(request.sessionId);
    if (!session) throw notFound(`Session ${request.sessionId}`);
    const branch = `deck/${session.id}`;
    const targetPath = worktreePathFor(session.cwd, session.id);
    await this.deps.worktrees.add({ repoDir: session.cwd, branch, targetPath });
    this.deps.sessions.applyWorktree(session.id, targetPath, branch);
    return this.save({ ...request, status: 'approved', resultPath: targetPath });
  }

  private save(request: ApprovalRequest): ApprovalRequest {
    this.requests.set(request.id, request);
    this.deps.bus.publish({ kind: 'approval', request });
    return request;
  }
}
