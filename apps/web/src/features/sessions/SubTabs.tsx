import { familyOf } from './family';
import { useT } from '../../shared/i18n/store';
import { useProfiles } from './profilesStore';
import { sessionLabel } from './sessionLabel';
import { useSessions } from './sessionsStore';
import { useCloseSession } from './useCloseSession';

/** Tabs for a session and the sub-terminals opened from it (a shell in a folder, for git and such). */
export function SubTabs() {
  const t = useT();
  const { sessions, activeId, select } = useSessions();
  const providers = useProfiles((s) => s.providers);
  const close = useCloseSession();
  const family = familyOf(sessions, activeId);
  if (!family) return null;
  return (
    <nav className="subtabs" aria-label={t('subtabs.label')}>
      {family.map((session) => (
        <span key={session.id} className={`subtab${session.id === activeId ? ' active' : ''}`}>
          <button type="button" className="subtab-pick" onClick={() => select(session.id)}>
            <span className={`dot ${session.status}`} />
            {session.parentId === null ? t('subtabs.main') : sessionLabel(session, providers)}
          </button>
          {session.parentId !== null && (
            <button
              type="button"
              className="subtab-x"
              aria-label={t('tabs.closeAria')}
              onClick={() => close(session)}
            >
              ×
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}
