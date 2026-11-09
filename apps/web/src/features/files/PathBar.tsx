import { useEffect, useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { toAbsolute, toRelative } from './explorerPath';

interface Props {
  cwd: string;
  dir: string;
  onGo(relative: string): void;
  onBack(): void;
  /** Bases the session in the folder being shown. */
  onUseFolder(absolute: string): void;
}

/** Back button plus an editable absolute folder path that can be copied or typed to jump. */
export function PathBar({ cwd, dir, onGo, onBack, onUseFolder }: Props) {
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
    void navigator.clipboard
      ?.writeText(shown)
      .then(() => setNote(t('files.copied')))
      .catch(() => undefined);
  };

  return (
    <div className="path-bar">
      <button type="button" disabled={dir === ''} onClick={onBack} aria-label={t('files.back')}>
        ←
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
        ⧉
      </button>
      <button
        type="button"
        disabled={dir === ''}
        onClick={() => onUseFolder(shown)}
        title={t('files.useFolder')}
        aria-label={t('files.useFolder')}
      >
        📌
      </button>
      {note !== null && <span className="hint path-note">{note}</span>}
    </div>
  );
}
