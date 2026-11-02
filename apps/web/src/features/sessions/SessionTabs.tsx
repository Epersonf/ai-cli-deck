import type { Session } from '@deck/shared';
import { useSessions } from './sessionsStore';

const basename = (path: string): string => path.replace(/\/+$/, '').split('/').pop() || '/';
export const sessionLabel = (s: Session): string => `${s.provider} · ${basename(s.cwd)}`;

export function SessionTabs({ onNew }: { onNew(): void }) {
  const { sessions, activeId, select, remove } = useSessions();

  const close = (session: Session): void => {
    if (window.confirm(`Close ${sessionLabel(session)}? The process will be stopped.`)) {
      void remove(session.id).catch(() => undefined);
    }
  };

  return (
    <div className="tabs" role="tablist">
      {sessions.map((session) => (
        <div key={session.id} className={`tab${session.id === activeId ? ' active' : ''}`}>
          <button
            type="button"
            role="tab"
            aria-selected={session.id === activeId}
            onClick={() => select(session.id)}
          >
            <span className={`dot ${session.status}`} />
            {sessionLabel(session)}
            {session.sharedCwdWith.length > 0 && (
              <span className="warn" title="Another session is using this folder">
                ⚠
              </span>
            )}
          </button>
          <button
            type="button"
            className="close"
            aria-label="Close session"
            onClick={() => close(session)}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="new-tab" onClick={onNew} aria-label="New session">
        ＋
      </button>
    </div>
  );
}
