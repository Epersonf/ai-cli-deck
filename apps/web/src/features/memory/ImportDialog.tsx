import type { MemoryTree } from '@deck/shared';
import { useEffect, useState } from 'react';
import { memoryApi } from '../../shared/api/memoryApi';
import { useT } from '../../shared/i18n/store';
import { useProfiles } from '../sessions/profilesStore';
import { buildTree, type FolderNode } from './memoryTree';

interface Props {
  /** The profile that receives the notes (Global is never a destination). */
  to: string;
  onDone(): void;
  onClose(): void;
}

/** Copies notes and folders of another profile into this one, after a summary the person confirms. */
export function ImportDialog({ to, onDone, onClose }: Props) {
  const t = useT();
  const providers = useProfiles((s) => s.providers).filter((p) => p.id !== to);
  const [from, setFrom] = useState(providers[0]?.id ?? '');
  const [tree, setTree] = useState<MemoryTree>({ folders: [], entries: [] });
  const [notes, setNotes] = useState<ReadonlySet<string>>(new Set());
  const [folders, setFolders] = useState<ReadonlySet<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (from === '') return;
    setNotes(new Set());
    setFolders(new Set());
    memoryApi
      .tree('profile', from)
      .then(setTree)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'failed'));
  }, [from]);

  const flip = (set: ReadonlySet<string>, id: string): Set<string> =>
    new Set(set.has(id) ? [...set].filter((x) => x !== id) : [...set, id]);
  const run = (): void =>
    void memoryApi
      .importNotes({ fromProfile: from, toProfile: to, ids: [...notes], folderIds: [...folders] })
      .then(onDone)
      .catch(
        (e: unknown) => (setError(e instanceof Error ? e.message : 'failed'), setConfirming(false)),
      );
  const nameOf = (id: string): string => providers.find((p) => p.id === id)?.label ?? id;

  const branch = (
    node: { folders: FolderNode[]; entries: MemoryTree['entries'] },
    depth: number,
  ) => (
    <>
      {node.folders.map((child) => (
        <div key={child.folder.id}>
          <label className="check" style={{ paddingLeft: depth * 16 }}>
            <input
              type="checkbox"
              checked={folders.has(child.folder.id)}
              onChange={() => setFolders(flip(folders, child.folder.id))}
            />
            {child.folder.name}
          </label>
          {branch(child, depth + 1)}
        </div>
      ))}
      {node.entries.map((note) => (
        <label key={note.id} className="check" style={{ paddingLeft: depth * 16 + 8 }}>
          <input
            type="checkbox"
            checked={notes.has(note.id)}
            onChange={() => setNotes(flip(notes, note.id))}
          />
          {note.title}
        </label>
      ))}
    </>
  );
  const none = notes.size + folders.size === 0;

  return (
    <div className="modal-backdrop confirm-backdrop" onClick={onClose}>
      <div className="modal memory-import" onClick={(e) => e.stopPropagation()}>
        <h2>{t('memory.import')}</h2>
        <label>
          {t('memory.importFrom')}
          <select value={from} onChange={(e) => (setFrom(e.target.value), setConfirming(false))}>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <div className="memory-import-tree">
          {tree.entries.length + tree.folders.length === 0 ? (
            <p className="empty">{t('memory.importNothing')}</p>
          ) : (
            branch(buildTree(tree.folders, tree.entries), 0)
          )}
        </div>
        {confirming && (
          <p className="notice">
            {t('memory.importConfirm', {
              notes: notes.size,
              folders: folders.size,
              from: nameOf(from),
              to: nameOf(to),
            })}
          </p>
        )}
        {error !== null && <p className="notice error">{error}</p>}
        <div className="dialog-actions">
          <button
            type="button"
            className="primary"
            disabled={none}
            onClick={() => (confirming ? run() : setConfirming(true))}
          >
            {confirming ? t('memory.importDo') : t('memory.importNext')}
          </button>
          <button type="button" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
