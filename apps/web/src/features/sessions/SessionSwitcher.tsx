import { useT } from '../../shared/i18n/store';
import { sessionLabel } from './sessionLabel';
import { useCloseSession } from './useCloseSession';
import { useSessions } from './sessionsStore';

interface Props {
  onNew(): void;
  onClose(): void;
}

/** Every terminal in one list: one tap to jump, works the same on phone and desktop. */
export function SessionSwitcher({ onNew, onClose }: Props) {
  const t = useT();
  const { sessions, activeId, select } = useSessions();
  const close = useCloseSession();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h2>{t('switcher.title')}</h2>
        {sessions.length === 0 && <p className="empty">{t('switcher.empty')}</p>}
        <ul className="session-list">
          {sessions.map((session, index) => (
            <li key={session.id}>
              <button
                type="button"
                className={`session-row${session.id === activeId ? ' active' : ''}`}
                onClick={() => (select(session.id), onClose())}
              >
                <span className={`dot ${session.status}`} />
                <span className="session-main">
                  <strong>{sessionLabel(session)}</strong>
                  <small>{session.cwd}</small>
                </span>
                {session.sharedCwdWith.length > 0 && (
                  <span className="warn" title={t('tabs.sharedFolder')}>
                    ⚠
                  </span>
                )}
                <span className="badge">{t(`status.${session.status}`)}</span>
                {index < 9 && <kbd>Alt+{index + 1}</kbd>}
              </button>
              <button
                type="button"
                className="close"
                aria-label={t('tabs.closeAria')}
                onClick={() => close(session)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <p className="hint">{t('switcher.hint')}</p>
        <div className="row">
          <button type="button" className="primary" onClick={() => (onClose(), onNew())}>
            {t('topbar.newSession')}
          </button>
          <button type="button" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
