import type { GitChange } from '@deck/shared';
import { useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { useConfirm } from '../confirm/confirmStore';
import { DiffView } from './DiffView';
import { codeLetter } from './useReview';

interface Props {
  sessionId: string;
  change: GitChange;
  checked: boolean;
  busy: boolean;
  /** Bumped after every refresh, so an open diff reloads. */
  version: number;
  onCheck(checked: boolean): void;
  onDiscard(): void;
}

/** A changed file: pick it for the commit, tap the name to see its diff, or throw the change away. */
export function ChangeRow({
  sessionId,
  change,
  checked,
  busy,
  version,
  onCheck,
  onDiscard,
}: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const letter = codeLetter(change.code);
  const discard = (): void =>
    useConfirm.getState().ask({
      title: t('changes.discardTitle'),
      message: t(letter === '?' ? 'changes.discardNew' : 'changes.discardBody', {
        path: change.path,
      }),
      confirmLabel: t('changes.discard'),
      cancelLabel: t('common.cancel'),
      onConfirm: onDiscard,
    });
  return (
    <li className={`change${open ? ' open' : ''}`}>
      <div className="change-row">
        <input
          type="checkbox"
          checked={checked}
          aria-label={change.path}
          onChange={(e) => onCheck(e.target.checked)}
        />
        <span className={`change-code code-${letter === '?' ? 'new' : letter}`}>{letter}</span>
        <button type="button" className="change-path" onClick={() => setOpen(!open)}>
          {change.from ? `${change.from} → ${change.path}` : change.path}
        </button>
        <button
          type="button"
          className="tool"
          disabled={busy}
          title={t('changes.discard')}
          aria-label={t('changes.discard')}
          onClick={discard}
        >
          ↺
        </button>
      </div>
      {open && <DiffView sessionId={sessionId} path={change.path} version={version} />}
    </li>
  );
}
