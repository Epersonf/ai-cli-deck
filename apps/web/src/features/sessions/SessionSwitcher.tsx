import { useMemo, useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { ModalTitle } from '../../shared/ui/ModalTitle';
import { groupSessions } from './groupSessions';
import { ProfileList } from './ProfileList';
import { ProfileView } from './ProfileView';
import { useProfiles } from './profilesStore';
import { useSessions } from './sessionsStore';

interface Props {
  onNew(profileId: string | null): void;
  onProfile(): void;
  onClose(): void;
}

/**
 * Side drawer in two levels: the profiles first (searchable), then the terminals of the one you open.
 * Keeping them apart stops the list from turning into one long mix of every terminal ever started.
 */
export function SessionSwitcher({ onNew, onProfile, onClose }: Props) {
  const t = useT();
  const { sessions, select, activeId } = useSessions();
  const providers = useProfiles((s) => s.providers);
  const groups = useMemo(() => groupSessions(providers, sessions), [providers, sessions]);
  // Reopening the drawer lands on the profile of the terminal you are in; "back" shows all profiles.
  const [openId, setOpenId] = useState<string | null>(() => {
    const active = sessions.find((s) => s.id === activeId);
    // A sub-terminal belongs to its main session's profile.
    const root = sessions.find((s) => s.id === active?.parentId) ?? active;
    return root?.provider ?? null;
  });
  // A profile that was deleted while open drops back to the list.
  const open = groups.find((g) => g.id === openId) ?? null;
  const newIn = (id: string): void => (onClose(), onNew(id));
  const pick = (id: string): void => (select(id), onClose());

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <ModalTitle title={t('switcher.profiles')} onClose={onClose} />
        {open ? (
          <ProfileView
            group={open}
            onBack={() => setOpenId(null)}
            onNewSession={() => newIn(open.id)}
            onPick={(session) => pick(session.id)}
          />
        ) : (
          <>
            <button type="button" className="primary" onClick={() => (onClose(), onProfile())}>
              {t('switcher.newProfile')}
            </button>
            <ProfileList
              groups={groups}
              onOpen={setOpenId}
              onNewSession={newIn}
              onPick={(session) => pick(session.id)}
            />
          </>
        )}
      </aside>
    </div>
  );
}
