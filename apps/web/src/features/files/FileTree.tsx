import type { FileEntry } from '@deck/shared';
import { useEffect, useState } from 'react';
import { api } from '../../shared/api/endpoints';
import { iconFor } from './fileIcon';

interface LevelProps {
  sessionId: string;
  path: string;
  depth: number;
  showIgnored: boolean;
  reloadKey: number;
  changes: Readonly<Record<string, string>>;
  selected: string | null;
  onOpen(path: string): void;
}

function TreeLevel(props: LevelProps) {
  const { sessionId, path, depth, showIgnored, reloadKey, changes, selected, onOpen } = props;
  const [entries, setEntries] = useState<FileEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    api
      .tree(sessionId, path, showIgnored)
      .then((tree) => !cancelled && (setEntries(tree.entries), setError(null)))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'failed'));
    return () => {
      cancelled = true;
    };
  }, [sessionId, path, showIgnored, reloadKey]);

  const toggle = (entry: FileEntry): void => {
    if (entry.kind === 'file') return onOpen(entry.path);
    const next = new Set(expanded);
    if (!next.delete(entry.path)) next.add(entry.path);
    setExpanded(next);
  };

  if (error !== null) return <p className="notice error">{error}</p>;
  if (entries === null) return <p className="hint">Loading…</p>;
  return (
    <ul className="tree">
      {entries.map((entry) => (
        <li key={entry.path}>
          <button
            type="button"
            className={`tree-row${entry.ignored ? ' ignored' : ''}${selected === entry.path ? ' selected' : ''}`}
            style={{ paddingLeft: 8 + depth * 14 }}
            onClick={() => toggle(entry)}
            title={entry.ignored ? `${entry.path} (ignored by git)` : entry.path}
          >
            <span aria-hidden>
              {entry.kind === 'dir'
                ? expanded.has(entry.path)
                  ? '📂'
                  : '📁'
                : iconFor(entry.name, 'file')}
            </span>
            <span className="tree-name">{entry.name}</span>
            {changes[entry.path] !== undefined && (
              <span className="git-code">{changes[entry.path]}</span>
            )}
          </button>
          {entry.kind === 'dir' && expanded.has(entry.path) && (
            <TreeLevel {...props} path={entry.path} depth={depth + 1} />
          )}
        </li>
      ))}
      {entries.length === 0 && <li className="hint">Empty folder</li>}
    </ul>
  );
}

interface Props {
  sessionId: string;
  selected: string | null;
  onOpen(path: string): void;
}

export function FileTree({ sessionId, selected, onOpen }: Props) {
  const [showIgnored, setShowIgnored] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [changes, setChanges] = useState<Record<string, string>>({});

  useEffect(() => {
    api
      .git(sessionId)
      .then((git) => setChanges(Object.fromEntries(git.changes.map((c) => [c.path, c.code]))))
      .catch(() => setChanges({}));
  }, [sessionId, reloadKey]);

  return (
    <div className="file-tree">
      <div className="tree-tools">
        <button type="button" onClick={() => setReloadKey((k) => k + 1)}>
          ⟳ Refresh
        </button>
        <label>
          <input
            type="checkbox"
            checked={showIgnored}
            onChange={(e) => setShowIgnored(e.target.checked)}
          />
          .git / node_modules
        </label>
      </div>
      <TreeLevel
        sessionId={sessionId}
        path=""
        depth={0}
        showIgnored={showIgnored}
        reloadKey={reloadKey}
        changes={changes}
        selected={selected}
        onOpen={onOpen}
      />
    </div>
  );
}
