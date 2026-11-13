import { useEffect, useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { HomeIcon, PinIcon } from '../../shared/ui/GlyphIcons';
import { CopyIcon } from '../../shared/ui/ToolIcons';
import { copyText } from '../settings/templateFile';
import { toast } from '../../shared/ui/toast';
import { isTop, toAbsolute, toRelative } from './explorerPath';

interface Props {
  cwd: string;
  dir: string;
  onGo(relative: string): void;
  onBack(): void;
  /** The folder this session was based in before it was pinned here; null when it is not pinned. */
  pinnedFrom: string | null;
  /** Bases the session in the folder being shown. */
  onPin(absolute: string): void;
  /** Goes back to the folder the session was based in. */
  onUnpin(): void;
}

/** Back button plus an editable absolute folder path that can be copied or typed to jump, and pinned. */
export function PathBar({ cwd, dir, onGo, onBack, pinnedFrom, onPin, onUnpin }: Props) {
  const t = useT();
  const shown = toAbsolute(cwd, dir);
  const [text, setText] = useState(shown);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => (setText(shown), setNote(null), undefined), [shown]);

  const submit = (): void => {
    const relative = toRelative(cwd, text);
    if (relative === null) return setNote(t('files.outside'));
    setNote(null);
    onGo(relative);
  };
  const copy = (): void => {
    void copyText(shown)
      .then(() => toast(t('files.copied')))
      .catch(() => undefined);
  };
  const pinned = pinnedFrom !== null;
  const pinLabel = pinned ? t('files.unpin', { folder: pinnedFrom }) : t('files.useFolder');

  return (
    <div className="path-bar">
      <button
        type="button"
        disabled={isTop(cwd, dir)}
        onClick={onBack}
        aria-label={t('files.back')}
      >
        ←
      </button>
      <button
        type="button"
        disabled={dir === ''}
        onClick={() => onGo('')}
        title={t('files.home')}
        aria-label={t('files.home')}
      >
        <HomeIcon size={18} />
      </button>
      <input
        value={text}
        aria-label={t('files.pathAria')}
        spellCheck={false}
        autoCapitalize="off"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        onFocus={(e) => e.currentTarget.select()}
      />
      <button type="button" onClick={copy} title={t('files.copy')} aria-label={t('files.copy')}>
        <CopyIcon size={18} />
      </button>
      <button
        type="button"
        className={pinned ? 'pinned' : ''}
        aria-pressed={pinned}
        disabled={!pinned && dir === ''}
        onClick={() => (pinned ? onUnpin() : onPin(shown))}
        title={pinLabel}
        aria-label={pinLabel}
      >
        <PinIcon size={18} pinned={pinned} />
      </button>
      {note !== null && <span className="hint path-note">{note}</span>}
    </div>
  );
}
