import type { MemoryEntry, MemoryFolder } from '@deck/shared';
import { memoryApi } from '../../shared/api/memoryApi';
import { FolderRow, NoteRow } from './MemoryRows';
import type { FolderNode, RootNode } from './memoryTree';
import { countNotes } from './memoryTree';
import type { useMemoryView } from './useMemoryView';

type View = ReturnType<typeof useMemoryView> & {
  open: ReadonlySet<string>;
  current: string | null;
};

interface Props {
  node: RootNode | FolderNode;
  depth: number;
  view: View;
  onToggle(id: string): void;
  onDrop(payload: string, target: string | null): void;
  onEdit(note: MemoryEntry): void;
  onMove(item: { note: MemoryEntry } | { folder: MemoryFolder }): void;
  onNameFolder(folder: MemoryFolder): void;
  onDeleteFolder(folder: MemoryFolder): void;
  onDeleteNote(note: MemoryEntry): void;
}

/** The folders and notes inside one folder (or the top), each folder showing its own when expanded. */
export function MemoryBranch(props: Props) {
  const { node, depth, view } = props;
  return (
    <>
      {node.folders.map((child) => {
        const { folder } = child;
        const open = view.open.has(folder.id);
        return (
          <div key={folder.id}>
            <FolderRow
              folder={folder}
              depth={depth}
              open={open}
              selected={view.current === folder.id}
              count={countNotes(view.tree.folders, view.tree.entries, folder.id)}
              onToggle={() => props.onToggle(folder.id)}
              onRename={() => props.onNameFolder(folder)}
              onMove={() => props.onMove({ folder })}
              onDelete={() => props.onDeleteFolder(folder)}
              onDropped={(payload) => props.onDrop(payload, folder.id)}
            />
            {open && <MemoryBranch {...props} node={child} depth={depth + 1} />}
          </div>
        );
      })}
      {node.entries.map((note) => (
        <NoteRow
          key={note.id}
          note={note}
          depth={depth}
          onEdit={() => props.onEdit(note)}
          onToggle={() =>
            void view.run(() => memoryApi.updateNote(note.id, { enabled: !note.enabled }))
          }
          onMove={() => props.onMove({ note })}
          onDelete={() => props.onDeleteNote(note)}
        />
      ))}
    </>
  );
}
