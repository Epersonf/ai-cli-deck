import type { MemoryEntry, MemoryFolder, MemoryScope } from '@deck/shared';
import { memoryApi } from '../../shared/api/memoryApi';
import { useT } from '../../shared/i18n/store';
import { useConfirm } from '../confirm/confirmStore';
import { countNotes } from './memoryTree';
import type { useMemoryView } from './useMemoryView';

export type Moving = { note: MemoryEntry } | { folder: MemoryFolder } | null;
export type Naming = { rename: MemoryFolder } | 'new' | null;
export interface Draft {
  title: string;
  body: string;
  enabled: boolean;
}

/** The changes the explorer can make: each runs against the deck, then the screen shows what the deck has. */
export function useExplorerActions(
  scope: MemoryScope,
  profileId: string | null,
  view: ReturnType<typeof useMemoryView>,
  current: string | null,
) {
  const t = useT();
  const ask = useConfirm((s) => s.ask);
  const { tree, run } = view;

  const confirmDelete = (message: string, change: () => Promise<unknown>): void =>
    ask({
      title: t('memory.delete'),
      message,
      confirmLabel: t('memory.delete'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => void run(change),
    });

  return {
    /** An item dropped on a folder (or on the top): `note:<id>` or `folder:<id>`. */
    drop(payload: string, target: string | null): void {
      const [kind, id] = payload.split(':');
      const note = kind === 'note' ? tree.entries.find((e) => e.id === id) : undefined;
      const folder = kind === 'folder' ? tree.folders.find((f) => f.id === id) : undefined;
      if (note) void view.moveNote(note, target);
      if (folder) void view.moveFolder(folder, target);
    },
    deleteFolder: (folder: MemoryFolder): void =>
      confirmDelete(
        t('memory.deleteFolder', {
          name: folder.name,
          count: countNotes(tree.folders, tree.entries, folder.id),
        }),
        () => memoryApi.deleteFolder(folder.id),
      ),
    deleteNote: (note: MemoryEntry): void =>
      confirmDelete(t('memory.deleteNote', { title: note.title }), () =>
        memoryApi.deleteNote(note.id),
      ),
    saveNote: (editing: MemoryEntry | 'new', draft: Draft): Promise<boolean> =>
      editing === 'new'
        ? run(() => memoryApi.createNote({ scope, profileId, folderId: current, ...draft }))
        : run(() => memoryApi.updateNote(editing.id, draft)),
    nameFolder(naming: Exclude<Naming, null>, name: string): void {
      if (naming === 'new') {
        void run(() => memoryApi.createFolder({ scope, profileId, name, parentId: current }));
      } else void run(() => memoryApi.updateFolder(naming.rename.id, { name }));
    },
    moveTo(moving: Exclude<Moving, null>, target: string | null): void {
      if ('note' in moving) void view.moveNote(moving.note, target);
      else void view.moveFolder(moving.folder, target);
    },
  };
}
