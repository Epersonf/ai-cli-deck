import { useEffect, useState } from 'react';
import { api } from '../../shared/api/endpoints';
import { ConfirmDelete } from './ConfirmDelete';
import { ExplorerOptions } from './ExplorerOptions';
import { useSessions } from '../sessions/sessionsStore';
import { loadPrefs, savePrefs, type ExplorerPrefs } from './explorerPrefs';
import { FileList } from './FileList';
import { parentOf } from './explorerPath';
import { PathBar } from './PathBar';
import { TransferDialog } from './TransferDialog';
import { TreeTools } from './TreeTools';
import { useFilesTick } from './filesTick';
import { usePins } from './pinStore';
import { useUpload } from './Uploader';

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
  const [prefs, setPrefs] = useState<ExplorerPrefs>(loadPrefs);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [manualKey, setReloadKey] = useState(0);
  // The agent finished a tool or a turn: reload as if the refresh button was pressed.
  const reloadKey = manualKey + useFilesTick((s) => s.byId[sessionId] ?? 0);
  const pinnedFrom = usePins((s) => s.from[sessionId] ?? null);
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState(false);
  const { upload, note, busy } = useUpload({
    sessionId,
    dir,
    onDone: () => setReloadKey((k) => k + 1),
  });

  useEffect(() => {
    api
      .git(sessionId)
      .then((git) => setChanges(Object.fromEntries(git.changes.map((c) => [c.path, c.code]))))
      .catch(() => setChanges({}));
  }, [sessionId, reloadKey]);

  return (
    <div
      className={`file-tree${dragging ? ' drop-target' : ''}`}
      onDragOver={(e) => (e.preventDefault(), setDragging(true))}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void upload([...e.dataTransfer.files]);
      }}
    >
      <PathBar
        cwd={cwd}
        dir={dir}
        onGo={onDir}
        onBack={() => onDir(parentOf(dir))}
        pinnedFrom={pinnedFrom}
        onPin={(path) => {
          usePins.getState().pin(sessionId, cwd);
          onDir('');
          void useSessions.getState().setFolder(sessionId, path);
        }}
        onUnpin={() => {
          if (pinnedFrom === null) return;
          usePins.getState().unpin(sessionId);
          onDir('');
          void useSessions.getState().setFolder(sessionId, pinnedFrom);
        }}
      />
      <TreeTools
        busy={busy}
        canDelete={dir !== ''}
        onRefresh={() => setReloadKey((k) => k + 1)}
        onTransfer={() => setTransferOpen(true)}
        onOptions={() => setOptionsOpen(true)}
        onDelete={() => setDeleteOpen(true)}
      />
      {transferOpen && (
        <TransferDialog
          sessionId={sessionId}
          dir={dir}
          busy={busy}
          onFiles={(files) => void upload(files)}
          onClose={() => setTransferOpen(false)}
        />
      )}
      {deleteOpen && (
        <ConfirmDelete
          sessionId={sessionId}
          path={dir}
          kind="dir"
          onDeleted={() => onDir(parentOf(dir))}
          onClose={() => setDeleteOpen(false)}
        />
      )}
      {optionsOpen && (
        <ExplorerOptions
          prefs={prefs}
          onChange={(next) => (setPrefs(next), savePrefs(next))}
          onClose={() => setOptionsOpen(false)}
        />
      )}
      {note !== null && <p className="hint">{note}</p>}
      <FileList
        sessionId={sessionId}
        dir={dir}
        prefs={prefs}
        reloadKey={reloadKey}
        changes={changes}
        selected={selected}
        onOpenDir={onDir}
        onOpenFile={onOpen}
        onChanged={() => setReloadKey((k) => k + 1)}
      />
    </div>
  );
}
