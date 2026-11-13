import type { Session } from '@deck/shared';
import { useState, type FormEvent } from 'react';
import { useT } from '../../shared/i18n/store';
import { PencilIcon, TransferIcon } from '../../shared/ui/Icons';
import { KebabMenu } from '../../shared/ui/KebabMenu';
import { useFork } from './forkStore';
import { useChatTitles } from './chatTitlesStore';
import { useProfiles } from './profilesStore';
import { sessionLabel } from './sessionLabel';
import { activityOf, sessionTime } from './sessionTime';
import { useCloseSession } from './useCloseSession';
import { useSessions } from './sessionsStore';
import { ForkIcon, WarnIcon } from '../../shared/ui/GlyphIcons';

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
  const providers = useProfiles((s) => s.providers);
  const title = useChatTitles((s) => s.titles[session.id]);
  const sideCount = useSessions((s) => s.sessions.filter((x) => x.parentId === session.id).length);
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
      <button
        type="button"
        className={`session-row${active ? ' active' : ''}`}
        data-status={session.status}
        aria-busy={session.status === 'working'}
        title={t(`status.${session.status}`)}
        onClick={onPick}
      >
        <span className="session-main">
          <strong>{sessionLabel(session, providers)}</strong>
          {title !== undefined && <small className="session-title">{title}</small>}
          <small>{session.cwd}</small>
        </span>
        <time className="session-time" dateTime={activityOf(session)}>
          {sessionTime(activityOf(session))}
        </time>
        {sideCount > 0 && (
          <span className="badge" title={t('side.title')}>
            <ForkIcon size={14} /> {sideCount}
          </span>
        )}
        {session.sharedCwdWith.length > 0 && (
          <span className="warn" title={t('tabs.sharedFolder')}>
            <WarnIcon size={14} />
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
          {
            label: t('fork.menu'),
            icon: <TransferIcon size={16} />,
            onSelect: () => useFork.getState().open(session),
          },
          { label: t('tabs.closeAria'), danger: true, onSelect: () => close(session) },
        ]}
      />
    </>
  );
}
