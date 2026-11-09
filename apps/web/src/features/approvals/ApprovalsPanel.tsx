import { useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { useSessions } from '../sessions/sessionsStore';
import { useApprovals } from './approvalsStore';

export function ApprovalsPanel() {
  const t = useT();
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
        <h2>{t('approvals.title')}</h2>
        {pending.length === 0 && <p className="empty">{t('approvals.none')}</p>}
        {pending.map((request) => {
          const session = sessions.find((s) => s.id === request.sessionId);
          return (
            <article className="approval" key={request.id}>
              <h3>{request.kind === 'folder' ? t('approvals.folder') : t('approvals.worktree')}</h3>
              <p>{request.reason}</p>
              <p className="hint">
                {request.kind === 'folder'
                  ? t('approvals.folderDetail', {
                      provider: session?.provider ?? '?',
                      cwd: session?.cwd ?? request.sessionId,
                      path: request.path ?? '?',
                    })
                  : t('approvals.detail', {
                      provider: session?.provider ?? '?',
                      cwd: session?.cwd ?? request.sessionId,
                      id: request.sessionId,
                    })}
              </p>
              <div className="row">
                <button
                  type="button"
                  className="primary"
                  onClick={() => run(request.id, 'approve')}
                >
                  {t('approvals.approve')}
                </button>
                <button type="button" onClick={() => run(request.id, 'reject')}>
                  {t('approvals.reject')}
                </button>
              </div>
            </article>
          );
        })}
        {error !== null && <p className="notice error">{error}</p>}
        <button type="button" onClick={() => setOpen(false)}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}
