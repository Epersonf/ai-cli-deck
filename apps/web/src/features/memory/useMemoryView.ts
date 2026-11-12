import type { MemoryEntry, MemoryFolder, MemoryScope, MemoryTree } from '@deck/shared';
import { useCallback, useEffect, useState } from 'react';
import { memoryApi } from '../../shared/api/memoryApi';
import { useT } from '../../shared/i18n/store';
import { canMoveFolder } from './memoryTree';
import { treeKey, useMemory } from './memoryStore';

const EMPTY: MemoryTree = { folders: [], entries: [] };

/** One scope's memory (kept fresh by the deck's pushes) and the changes the person can make to it. */
export function useMemoryView(scope: MemoryScope, profileId: string | null) {
  const t = useT();
  const tree = useMemory((s) => s.trees[treeKey(scope, profileId)]) ?? EMPTY;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const message = (e: unknown): string => (e instanceof Error ? e.message : 'failed');

  const reload = useCallback(() => useMemory.getState().load(scope, profileId), [scope, profileId]);
  useEffect(() => {
    setLoading(true);
    reload()
      .then(() => setError(null))
      .catch((e: unknown) => setError(message(e)))
      .finally(() => setLoading(false));
  }, [reload]);

  /** Runs a change, then shows what the deck now has. */
  const run = async (change: () => Promise<unknown>): Promise<boolean> => {
    setError(null);
    try {
      await change();
      await reload();
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    }
  };

  const moveFolder = (folder: MemoryFolder, target: string | null): Promise<boolean> => {
    const verdict = canMoveFolder(tree.folders, folder.id, target);
    if (!verdict.ok) {
      setError(t(`memory.move.${verdict.reason}`));
      return Promise.resolve(false);
    }
    return run(() => memoryApi.updateFolder(folder.id, { parentId: target }));
  };
  const moveNote = (note: MemoryEntry, target: string | null): Promise<boolean> =>
    run(() => memoryApi.updateNote(note.id, { folderId: target }));

  return { tree, error, setError, loading, run, moveFolder, moveNote };
}
