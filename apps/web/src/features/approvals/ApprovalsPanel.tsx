import { useState } from 'react';
import { useSessions } from '../sessions/sessionsStore';
import { useApprovals } from './approvalsStore';

export function ApprovalsPanel() {
  const { pending, open, setOpen, decide } = useApprovals();
  const sessions = useSessions((s) => s.sessions);
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;

  const run = (id: string, decision: 'approve' | 'reject'): void => {
    setError(null);
    decide(id, decision).catch((e: unknown) => setError(e instanceof Error ? e.message : 'failed'));
  };

  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h2>Pending approvals</h2>
        {pending.length === 0 && <p className="empty">Nothing to approve.</p>}
        {pending.map((request) => {
          const session = sessions.find((s) => s.id === request.sessionId);
          return (
            <article className="approval" key={request.id}>
              <h3>Create a git worktree</h3>
              <p>{request.reason}</p>
              <p className="hint">
                {session ? `${session.provider} in ${session.cwd}` : request.sessionId} · branch
                deck/{request.sessionId}
              </p>
              <div className="row">
                <button
                  type="button"
                  className="primary"
                  onClick={() => run(request.id, 'approve')}
                >
                  Approve
                </button>
                <button type="button" onClick={() => run(request.id, 'reject')}>
                  Reject
                </button>
              </div>
            </article>
          );
        })}
        {error !== null && <p className="notice error">{error}</p>}
        <button type="button" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
    </div>
  );
}
