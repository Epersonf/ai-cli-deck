import { useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { PencilIcon, PlusIcon, TrashIcon } from '../../shared/ui/Icons';
import { KebabMenu, type MenuItem } from '../../shared/ui/KebabMenu';
import { useConfirm } from '../confirm/confirmStore';
import type { SessionGroup } from './groupSessions';
import { useProfiles } from './profilesStore';
import { useSessions } from './sessionsStore';

interface Props {
  group: SessionGroup;
  onNewSession(): void;
  children: ReactNode;
}

const KEY = 'deck.collapsedProfiles';
function readCollapsed(id: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]).includes(id);
  } catch {
    return false;
  }
}
function writeCollapsed(id: string, on: boolean): void {
  try {
    const set = new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]);
    if (on) set.add(id);
    else set.delete(id);
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    /* storage unavailable: collapse state just isn't remembered */
  }
}

/** A profile with its terminals: add a terminal, rename or delete the profile. */
export function ProfileGroup({ group, onNewSession, children }: Props) {
  const t = useT();
  const ask = useConfirm((s) => s.ask);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [collapsed, setCollapsed] = useState(() => readCollapsed(group.id));
  const toggle = (): void => {
    setCollapsed(!collapsed);
    writeCollapsed(group.id, !collapsed);
  };
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

  const items: MenuItem[] = [
    { label: t('profile.newTerminal'), icon: <PlusIcon size={16} />, onSelect: onNewSession },
  ];
  if (group.profile)
    items.push(
      {
        label: t('switcher.rename'),
        icon: <PencilIcon size={16} />,
        onSelect: () => (setName(group.label), setEditing(true)),
      },
      { label: t('profile.delete'), icon: <TrashIcon size={16} />, danger: true, onSelect: remove },
    );

  return (
    <section className={`profile-group${collapsed ? ' collapsed' : ''}`}>
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
            <button
              type="button"
              className="profile-toggle"
              aria-expanded={!collapsed}
              title={t('profile.toggle')}
              aria-label={`${t('profile.toggle')}: ${group.label}`}
              onClick={toggle}
            >
              <svg className="chev" width="14" height="14" viewBox="0 0 100 100" aria-hidden>
                <path d="M22 36l28 28 28-28" fill="none" stroke="currentColor" strokeWidth="12" />
              </svg>
              <h3 title={group.label}>{group.label}</h3>
              <span className="profile-count">{group.sessions.length}</span>
            </button>
            <KebabMenu items={items} />
          </>
        )}
      </header>
      {!collapsed && group.sessions.length === 0 && (
        <p className="hint">{t('profile.noTerminals')}</p>
      )}
      {!collapsed && <ul className="session-list">{children}</ul>}
    </section>
  );
}
