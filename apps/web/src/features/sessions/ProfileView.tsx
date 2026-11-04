import type { Session } from '@deck/shared';
import { useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { PlusIcon } from '../../shared/ui/Icons';
import { KebabMenu } from '../../shared/ui/KebabMenu';
import type { SessionGroup } from './groupSessions';
import { ProfileRename } from './ProfileRename';
import { useProfiles } from './profilesStore';
import { SessionRow } from './SessionRow';
import { useSessions } from './sessionsStore';
import { filterSessions } from './switcherSearch';
import { useProfileActions } from './useProfileActions';

interface Props {
  group: SessionGroup;
  onBack(): void;
  onNewSession(): void;
  onPick(session: Session): void;
}

/** Second level of the drawer: every terminal this profile ever had (live or ended), searchable by name. */
export function ProfileView({ group, onBack, onNewSession, onPick }: Props) {
  const t = useT();
  const sessions = useSessions((s) => s.sessions);
  const activeId = useSessions((s) => s.activeId);
  const providers = useProfiles((s) => s.providers);
  const actions = useProfileActions(group, onNewSession);
  const [query, setQuery] = useState('');
  const shown = filterSessions(group.sessions, providers, query);
  return (
    <>
      <div className="profile-head">
        <button
          type="button"
          className="drawer-back"
          aria-label={t('switcher.back')}
          title={t('switcher.back')}
          onClick={onBack}
        >
          ←
        </button>
        {actions.editing ? (
          <ProfileRename actions={actions} />
        ) : (
          <>
            <h3 title={group.label}>{group.label}</h3>
            <KebabMenu items={actions.items} />
          </>
        )}
      </div>
      <button type="button" className="primary" onClick={onNewSession}>
        <PlusIcon size={16} /> {t('profile.newTerminal')}
      </button>
      <input
        type="search"
        className="drawer-search"
        value={query}
        placeholder={t('switcher.searchTerminals')}
        aria-label={t('switcher.searchTerminals')}
        onChange={(e) => setQuery(e.target.value)}
      />
      {group.sessions.length === 0 && <p className="empty">{t('profile.noTerminals')}</p>}
      {group.sessions.length > 0 && shown.length === 0 && (
        <p className="empty">{t('switcher.noMatch')}</p>
      )}
      <ul className="session-list">
        {shown.map((session) => (
          <li key={session.id}>
            <SessionRow
              session={session}
              index={sessions.indexOf(session)}
              active={session.id === activeId}
              onPick={() => onPick(session)}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
