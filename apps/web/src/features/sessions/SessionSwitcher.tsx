import { useMemo } from 'react';
import { useT } from '../../shared/i18n/store';
import { groupSessions } from './groupSessions';
import { ProfileGroup } from './ProfileGroup';
import { useProfiles } from './profilesStore';
import { SessionRow } from './SessionRow';
import { useSessions } from './sessionsStore';

interface Props {
  onNew(profileId: string | null): void;
  onProfile(): void;
  onClose(): void;
}

/** Side drawer: terminals grouped by profile, with add/rename/delete per profile. */
export function SessionSwitcher({ onNew, onProfile, onClose }: Props) {
  const t = useT();
  const { sessions, activeId, select } = useSessions();
  const providers = useProfiles((s) => s.providers);
  const groups = useMemo(() => groupSessions(providers, sessions), [providers, sessions]);
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <h2>{t('switcher.title')}</h2>
        <button type="button" className="primary" onClick={() => (onClose(), onProfile())}>
          {t('switcher.newProfile')}
        </button>
        {groups.length === 0 && <p className="empty">{t('switcher.empty')}</p>}
        {groups.map((group) => (
          <ProfileGroup
            key={group.id}
            group={group}
            onNewSession={() => (onClose(), onNew(group.id))}
          >
            {group.sessions.map((session) => (
              <li key={session.id}>
                <SessionRow
                  session={session}
                  index={sessions.indexOf(session)}
                  active={session.id === activeId}
                  onPick={() => (select(session.id), onClose())}
                />
              </li>
            ))}
          </ProfileGroup>
        ))}
        <p className="hint">{t('switcher.hint')}</p>
        <button type="button" onClick={() => (onClose(), onNew(null))}>
          {t('topbar.newSession')}
        </button>
        <button type="button" onClick={onClose}>
          {t('common.close')}
        </button>
      </aside>
    </div>
  );
}
