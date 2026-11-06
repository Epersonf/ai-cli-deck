import { useState, type FormEvent } from 'react';
import { api } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { PencilIcon, PlusIcon, TrashIcon } from '../../shared/ui/Icons';
import type { MenuItem } from '../../shared/ui/KebabMenu';
import { useConfirm } from '../confirm/confirmStore';
import { useNetwork } from '../devices/networkStore';
import { useSendProfile } from '../devices/sendProfileStore';
import { PEER_ID } from '../../shared/api/base';
import type { SessionGroup } from './groupSessions';
import { useProfiles } from './profilesStore';
import { useSessions } from './sessionsStore';

/** Menu entries plus the inline-rename state of one profile (add terminal, rename, delete). */
export function useProfileActions(group: SessionGroup, onNewSession: () => void) {
  const t = useT();
  const ask = useConfirm((s) => s.ask);
  const [editing, setEditing] = useState(false);
  const paired = useNetwork((s) => s.peers.length > 0);
  const [name, setName] = useState('');

  const refresh = (): void => void useProfiles.getState().refresh();
  const submit = (event: FormEvent): void => {
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
          .catch(() => undefined)
          // refresh either way: the list must reflect what the server really ended up doing
          .then(() =>
            Promise.all([useSessions.getState().refresh(), useProfiles.getState().refresh()]),
          ),
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
  if (group.profile && paired && !PEER_ID)
    items.splice(1, 0, {
      label: t('devices.sendProfile'),
      onSelect: () => useSendProfile.getState().open({ id: group.id, label: group.label }),
    });
  return { items, editing, name, setName, submit, cancel: () => setEditing(false) };
}

export type ProfileActions = ReturnType<typeof useProfileActions>;
