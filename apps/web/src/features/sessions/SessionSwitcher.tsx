import { useT } from '../../shared/i18n/store';
import { SessionRow } from './SessionRow';
import { useSessions } from './sessionsStore';

interface Props {
  onNew(): void;
  onProfile(): void;
  onClose(): void;
}

/** Side drawer with every terminal: one tap to jump, rename, end, or add a session/profile. */
export function SessionSwitcher({ onNew, onProfile, onClose }: Props) {
  const t = useT();
  const { sessions, activeId, select } = useSessions();
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <h2>{t('switcher.title')}</h2>
        {sessions.length === 0 && <p className="empty">{t('switcher.empty')}</p>}
        <ul className="session-list">
          {sessions.map((session, index) => (
            <li key={session.id}>
              <SessionRow
                session={session}
                index={index}
                active={session.id === activeId}
                onPick={() => (select(session.id), onClose())}
              />
            </li>
          ))}
        </ul>
        <p className="hint">{t('switcher.hint')}</p>
        <button type="button" className="primary" onClick={() => (onClose(), onNew())}>
          {t('topbar.newSession')}
        </button>
        <button type="button" onClick={() => (onClose(), onProfile())}>
          {t('switcher.newProfile')}
        </button>
        <button type="button" onClick={onClose}>
          {t('common.close')}
        </button>
      </aside>
    </div>
  );
}
