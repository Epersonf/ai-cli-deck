import { useState, type FormEvent } from 'react';
import { useT } from '../../shared/i18n/store';
import { loadRecent } from '../sessions/recentFolders';
import { useDirs } from './useDirs';
import { FolderIcon } from '../../shared/ui/ShapeIcons';

interface Props {
  start: string;
  onPick(path: string): void;
  onClose(): void;
}

/** A modal folder browser: a click enters a folder (double-click or its Select button chooses it), then "Use this folder". */
export function FolderPicker({ start, onPick, onClose }: Props) {
  const t = useT();
  const { listing, error, loading, go } = useDirs(start);
  const [typed, setTyped] = useState('');
  const recent = loadRecent();
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (typed.trim() !== '') go(typed.trim());
  };
  return (
    <div className="modal-backdrop confirm-backdrop" onClick={onClose}>
      <div className="modal folder-picker" onClick={(e) => e.stopPropagation()}>
        <h2>{t('folder.title')}</h2>
        <div className="folder-bar">
          <button
            type="button"
            disabled={!listing?.parent}
            onClick={() => go(listing?.parent ?? null)}
          >
            ↑ {t('folder.up')}
          </button>
          <button type="button" disabled={!listing} onClick={() => go(listing?.home ?? null)}>
            {t('folder.home')}
          </button>
          {listing?.roots.map((root) => (
            <button key={root.path} type="button" className="chip" onClick={() => go(root.path)}>
              {root.name}
            </button>
          ))}
        </div>
        <p className="folder-path" title={listing?.path}>
          {listing?.path ?? '…'}
        </p>
        {error !== null && <p className="notice error">{error}</p>}
        <ul className="folder-list" aria-busy={loading}>
          {listing?.dirs.map((dir) => (
            <li key={dir.path}>
              <button
                type="button"
                className="folder-enter"
                onClick={() => go(dir.path)}
                onDoubleClick={() => onPick(dir.path)}
              >
                <FolderIcon size={16} /> {dir.name}
              </button>
              <button type="button" className="folder-select" onClick={() => onPick(dir.path)}>
                {t('folder.select')}
              </button>
            </li>
          ))}
          {listing?.dirs.length === 0 && <li className="hint">{t('folder.empty')}</li>}
        </ul>
        {recent.length > 0 && (
          <div className="folder-recent">
            <span className="hint">{t('folder.recent')}</span>
            {recent.map((folder) => (
              <button key={folder} type="button" title={folder} onClick={() => onPick(folder)}>
                {folder}
              </button>
            ))}
          </div>
        )}
        <form className="field-inline" onSubmit={submit}>
          <input
            value={typed}
            placeholder={t('folder.typePath')}
            aria-label={t('folder.typePath')}
            spellCheck={false}
            autoCapitalize="off"
            onChange={(e) => setTyped(e.target.value)}
          />
          <button type="submit">{t('folder.go')}</button>
        </form>
        <div className="dialog-actions">
          <button
            type="button"
            className="primary"
            disabled={!listing}
            onClick={() => listing && onPick(listing.path)}
          >
            {t('folder.use')}
          </button>
          <button type="button" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
