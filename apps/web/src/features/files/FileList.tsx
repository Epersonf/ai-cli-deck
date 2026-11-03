import type { FileEntry } from '@deck/shared';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { displayName, type ExplorerPrefs } from './explorerPrefs';
import { FileActionDialog } from './FileActionDialog';
import { iconFor } from './fileIcon';
import { changedFolders, labelOf, toneOf } from './gitMarks';

interface Props {
  sessionId: string;
  dir: string;
  prefs: ExplorerPrefs;
  reloadKey: number;
  changes: Readonly<Record<string, string>>;
  selected: string | null;
  onOpenDir(path: string): void;
  onOpenFile(path: string): void;
  onChanged(): void;
}

/** The contents of exactly one folder; clicking a folder navigates into it. */
export function FileList(props: Props) {
  const t = useT();
  const { sessionId, dir, prefs, reloadKey, changes, selected } = props;
  const [entries, setEntries] = useState<FileEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    api
      .tree(sessionId, dir, { hidden: prefs.hidden, ignored: prefs.ignored })
      .then((tree) => !cancelled && (setEntries(tree.entries), setError(null)))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'failed'));
    return () => {
      cancelled = true;
    };
  }, [sessionId, dir, prefs.hidden, prefs.ignored, reloadKey]);

  const dirty = useMemo(() => changedFolders(Object.keys(changes)), [changes]);

  if (error !== null) return <p className="notice error">{error}</p>;
  if (entries === null) return <p className="hint">{t('common.loading')}</p>;
  return (
    <ul className="tree">
      {entries.map((entry) => {
        const code = changes[entry.path.replace(/\/$/, '')];
        const tone =
          code !== undefined
            ? toneOf(code)
            : entry.kind === 'dir' && dirty.has(entry.path)
              ? 'modified'
              : null;
        return (
          <li key={entry.path}>
            <button
              type="button"
              className={`tree-row${entry.ignored ? ' ignored' : ''}${selected === entry.path ? ' selected' : ''}${tone !== null ? ` git-${tone}` : ''}`}
              onClick={() =>
                entry.kind === 'dir' ? props.onOpenDir(entry.path) : setAsking(entry.path)
              }
              title={entry.ignored ? t('files.ignoredTip', { path: entry.path }) : entry.path}
            >
              <span aria-hidden>{entry.kind === 'dir' ? '📁' : iconFor(entry.name, 'file')}</span>
              <span className="tree-name">
                {displayName(entry.name, entry.kind, prefs.extensions)}
              </span>
              {code !== undefined && <span className="git-code">{labelOf(code)}</span>}
              {code === undefined && tone !== null && (
                <span className="git-code" aria-label="changes inside">
                  ●
                </span>
              )}
            </button>
          </li>
        );
      })}
      {asking !== null && (
        <FileActionDialog
          sessionId={sessionId}
          path={asking}
          onOpen={() => props.onOpenFile(asking)}
          onDeleted={props.onChanged}
          onClose={() => setAsking(null)}
        />
      )}
      {entries.length === 0 && <li className="hint">{t('files.empty')}</li>}
    </ul>
  );
}
