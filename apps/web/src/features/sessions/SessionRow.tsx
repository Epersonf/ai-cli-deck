import type { Session } from '@deck/shared';
import { useState, type FormEvent } from 'react';
import { useT } from '../../shared/i18n/store';
import { PencilIcon, TransferIcon } from '../../shared/ui/Icons';
import { KebabMenu } from '../../shared/ui/KebabMenu';
import { api } from '../../shared/api/endpoints';
import { useConfirm } from '../confirm/confirmStore';
import { idleWatcher, useTasks } from '../tasks/tasksStore';
import { useFork } from './forkStore';
import { useChatTitles } from './chatTitlesStore';
import { useProfiles } from './profilesStore';
import { sessionLabel } from './sessionLabel';
import { sessionTime } from './sessionTime';
import { useCloseSession } from './useCloseSession';
import { useSessions } from './sessionsStore';

interface Props {
  session: Session;
  index: number;
  active: boolean;
  onPick(): void;
}

/** One entry of the terminals drawer: jump, rename inline, or end the session. */
export function SessionRow({ session, index, active, onPick }: Props) {
  const t = useT();
  const close = useCloseSession();
  const ask = useConfirm((x) => x.ask);
  const watching = useTasks((x) => idleWatcher(x.tasks, session.id)) !== undefined;
  const toggleQuiet = (): void =>
    void api
      .notifyIdle(session.id, !watching)
      .then(() => useTasks.getState().refresh())
      .catch((e: unknown) =>
        ask({
          title: t('tasks.notifyTitle'),
          message: e instanceof Error ? e.message : 'failed',
          confirmLabel: t('common.close'),
          cancelLabel: t('common.cancel'),
          onConfirm: () => undefined,
        }),
      );
  const providers = useProfiles((s) => s.providers);
  const title = useChatTitles((s) => s.titles[session.id]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  const save = (event: FormEvent): void => {
    event.preventDefault();
    setEditing(false);
    void useSessions
      .getState()
      .rename(session.id, name.trim() === '' ? null : name.trim())
      .catch(() => undefined);
  };

  if (editing) {
    return (
      <form className="session-rename" onSubmit={save}>
        <input
          autoFocus
          value={name}
          maxLength={60}
          placeholder={t('switcher.namePlaceholder')}
          aria-label={t('switcher.namePlaceholder')}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
        />
        <button type="submit" className="primary">
          {t('switcher.save')}
        </button>
      </form>
    );
  }
  return (
    <>
      <button type="button" className={`session-row${active ? ' active' : ''}`} onClick={onPick}>
        <span className={`dot ${session.status}`} title={t(`status.${session.status}`)} />
        <span className="session-main">
          <strong>{sessionLabel(session, providers)}</strong>
          {title !== undefined && <small className="session-title">{title}</small>}
          <small>{session.cwd}</small>
        </span>
        <time className="session-time" dateTime={session.createdAt}>
          {sessionTime(session.createdAt)}
        </time>
        {session.sharedCwdWith.length > 0 && (
          <span className="warn" title={t('tabs.sharedFolder')}>
            ⚠
          </span>
        )}
        {index < 9 && <kbd>{index + 1}</kbd>}
      </button>
      <KebabMenu
        items={[
          {
            label: t('switcher.rename'),
            icon: <PencilIcon size={16} />,
            onSelect: () => (setName(session.name ?? ''), setEditing(true)),
          },
          ...(session.parentId === null && session.provider !== 'shell'
            ? [
                {
                  label: t('fork.menu'),
                  icon: <TransferIcon size={16} />,
                  onSelect: () => useFork.getState().open(session),
                },
              ]
            : []),
          ...(session.parentId === null
            ? [
                {
                  label: watching ? t('tasks.notifyOff') : t('tasks.notifyOn'),
                  onSelect: toggleQuiet,
                },
              ]
            : []),
          { label: t('tabs.closeAria'), danger: true, onSelect: () => close(session) },
        ]}
      />
    </>
  );
}
