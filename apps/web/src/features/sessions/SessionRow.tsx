import type { Session } from '@deck/shared';
import { useState, type FormEvent } from 'react';
import { useT } from '../../shared/i18n/store';
import { PencilIcon } from '../../shared/ui/Icons';
import { useProfiles } from './profilesStore';
import { sessionLabel } from './sessionLabel';
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
  const providers = useProfiles((s) => s.providers);
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
          <small>{session.cwd}</small>
        </span>
        {session.sharedCwdWith.length > 0 && (
          <span className="warn" title={t('tabs.sharedFolder')}>
            ⚠
          </span>
        )}
        {index < 9 && <kbd>{index + 1}</kbd>}
      </button>
      <button
        type="button"
        className="close"
        title={t('switcher.rename')}
        aria-label={t('switcher.rename')}
        onClick={() => (setName(session.name ?? ''), setEditing(true))}
      >
        <PencilIcon />
      </button>
      <button
        type="button"
        className="close"
        aria-label={t('tabs.closeAria')}
        onClick={() => close(session)}
      >
        ×
      </button>
    </>
  );
}
