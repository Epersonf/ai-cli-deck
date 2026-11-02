import { useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { PencilIcon, PlusIcon, TrashIcon } from '../../shared/ui/Icons';
import { useConfirm } from '../confirm/confirmStore';
import type { SessionGroup } from './groupSessions';
import { useProfiles } from './profilesStore';
import { useSessions } from './sessionsStore';

interface Props {
  group: SessionGroup;
  onNewSession(): void;
  children: ReactNode;
}

/** A profile with its terminals: add a terminal, rename or delete the profile. */
export function ProfileGroup({ group, onNewSession, children }: Props) {
  const t = useT();
  const ask = useConfirm((s) => s.ask);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const refresh = (): void => void useProfiles.getState().refresh();

  const save = (event: FormEvent): void => {
    event.preventDefault();
    setEditing(false);
    if (name.trim() !== '')
      void api
        .renameProfile(group.id, name.trim())
        .then(refresh)
        .catch(() => undefined);
  };
  const remove = (): void =>
    ask({
      title: t('profile.deleteTitle'),
      message: t('profile.deleteBody', { name: group.label, count: group.sessions.length }),
      confirmLabel: t('profile.deleteAction'),
      cancelLabel: t('confirm.keep'),
      onConfirm: () =>
        void api
          .deleteProfile(group.id)
          .then(() =>
            Promise.all([useSessions.getState().refresh(), useProfiles.getState().refresh()]),
          )
          .catch(() => undefined),
    });

  return (
    <section className="profile-group">
      <header className="profile-head">
        {editing ? (
          <form className="session-rename" onSubmit={save}>
            <input
              autoFocus
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="primary">
              {t('switcher.save')}
            </button>
          </form>
        ) : (
          <>
            <h3 title={group.label}>{group.label}</h3>
            <button
              type="button"
              className="close"
              title={t('profile.newTerminal')}
              aria-label={t('profile.newTerminal')}
              onClick={onNewSession}
            >
              <PlusIcon />
            </button>
            {group.profile && (
              <>
                <button
                  type="button"
                  className="close"
                  title={t('switcher.rename')}
                  aria-label={t('switcher.rename')}
                  onClick={() => (setName(group.label), setEditing(true))}
                >
                  <PencilIcon />
                </button>
                <button
                  type="button"
                  className="close"
                  title={t('profile.delete')}
                  aria-label={t('profile.delete')}
                  onClick={remove}
                >
                  <TrashIcon />
                </button>
              </>
            )}
          </>
        )}
      </header>
      {group.sessions.length === 0 && <p className="hint">{t('profile.noTerminals')}</p>}
      <ul className="session-list">{children}</ul>
    </section>
  );
}
