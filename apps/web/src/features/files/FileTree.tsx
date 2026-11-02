import { useEffect, useState } from 'react';
import { api } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { FileList } from './FileList';
import { parentOf } from './explorerPath';
import { PathBar } from './PathBar';

interface Props {
  sessionId: string;
  cwd: string;
  dir: string;
  selected: string | null;
  onDir(path: string): void;
  onOpen(path: string): void;
}

/** One explorer: address bar with back, tools, and the current folder's entries. */
export function FileTree({ sessionId, cwd, dir, selected, onDir, onOpen }: Props) {
  const t = useT();
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
      <PathBar cwd={cwd} dir={dir} onGo={onDir} onBack={() => onDir(parentOf(dir))} />
      <div className="tree-tools">
        <button type="button" onClick={() => setReloadKey((k) => k + 1)}>
          ⟳ {t('common.refresh')}
        </button>
        <label>
          <input
            type="checkbox"
            checked={showIgnored}
            onChange={(e) => setShowIgnored(e.target.checked)}
          />
          {t('files.showHidden')}
        </label>
      </div>
      <FileList
        sessionId={sessionId}
        dir={dir}
        showIgnored={showIgnored}
        reloadKey={reloadKey}
        changes={changes}
        selected={selected}
        onOpenDir={onDir}
        onOpenFile={onOpen}
      />
    </div>
  );
}
