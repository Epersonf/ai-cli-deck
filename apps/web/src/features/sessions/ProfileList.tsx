import type { Session } from '@deck/shared';
import { useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { KebabMenu } from '../../shared/ui/KebabMenu';
import type { SessionGroup } from './groupSessions';
import { ProfileRename } from './ProfileRename';
import { useChatTitles } from './chatTitlesStore';
import { useProfiles } from './profilesStore';
import { SessionRow } from './SessionRow';
import { useSessions } from './sessionsStore';
import { filterGroups, filterSessions } from './switcherSearch';
import { useProfileActions } from './useProfileActions';

interface RowProps {
  group: SessionGroup;
  onOpen(): void;
  onNewSession(): void;
}

function ProfileRow({ group, onOpen, onNewSession }: RowProps) {
  const t = useT();
  const actions = useProfileActions(group, onNewSession);
  if (actions.editing) return <ProfileRename actions={actions} />;
  const live = group.sessions.filter((s) => s.status === 'working').length;
  return (
    <>
      <button type="button" className="profile-row" onClick={onOpen}>
        <span className={`dot ${live > 0 ? 'working' : 'idle'}`} />
        <h3 title={group.label}>{group.label}</h3>
        <span className="profile-count" title={t('switcher.title')}>
          {group.sessions.length}
        </span>
      </button>
      <KebabMenu items={actions.items} />
    </>
  );
}

interface Props {
  groups: readonly SessionGroup[];
  onOpen(id: string): void;
  onNewSession(id: string): void;
  onPick(session: Session): void;
}

/** First level of the drawer: the profiles, searchable; a search also finds terminals by name. */
export function ProfileList({ groups, onOpen, onNewSession, onPick }: Props) {
  const t = useT();
  const sessions = useSessions((s) => s.sessions);
  const activeId = useSessions((s) => s.activeId);
  const providers = useProfiles((s) => s.providers);
  const titles = useChatTitles((s) => s.titles);
  const [query, setQuery] = useState('');
  const shown = filterGroups(groups, query);
  const terminals = query.trim() === '' ? [] : filterSessions(sessions, providers, query, titles);
  return (
    <>
      <input
        type="search"
        className="drawer-search"
        value={query}
        placeholder={t('switcher.searchProfiles')}
        aria-label={t('switcher.searchProfiles')}
        onChange={(e) => setQuery(e.target.value)}
      />
      {groups.length === 0 && <p className="empty">{t('switcher.empty')}</p>}
      <ul className="session-list">
        {shown.map((group) => (
          <li key={group.id}>
            <ProfileRow
              group={group}
              onOpen={() => onOpen(group.id)}
              onNewSession={() => onNewSession(group.id)}
            />
          </li>
        ))}
      </ul>
      {terminals.length > 0 && (
        <>
          <h3 className="drawer-heading">{t('switcher.terminalsFound')}</h3>
          <ul className="session-list">
            {terminals.map((session) => (
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
      )}
      {query.trim() !== '' && shown.length === 0 && terminals.length === 0 && (
        <p className="empty">{t('switcher.noMatch')}</p>
      )}
    </>
  );
}
