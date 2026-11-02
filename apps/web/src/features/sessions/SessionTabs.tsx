import { useEffect, useRef } from 'react';
import { useT } from '../../shared/i18n/store';
import { sessionLabel } from './sessionLabel';
import { useCloseSession } from './useCloseSession';
import { useSessions } from './sessionsStore';

export function SessionTabs({ onNew }: { onNew(): void }) {
  const t = useT();
  const { sessions, activeId, select } = useSessions();
  const close = useCloseSession();
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    strip.current
      ?.querySelector('.tab.active')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [activeId, sessions.length]);

  return (
    <div className="tabs" role="tablist" ref={strip}>
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
              <span className="warn" title={t('tabs.sharedFolder')}>
                ⚠
              </span>
            )}
          </button>
          <button
            type="button"
            className="close"
            aria-label={t('tabs.closeAria')}
            onClick={() => close(session)}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="new-tab" onClick={onNew} aria-label={t('topbar.newSession')}>
        ＋
      </button>
    </div>
  );
}
