import type { MemoryEntry, MemoryFolder } from '@deck/shared';
import { useState, type DragEvent } from 'react';
import { useT } from '../../shared/i18n/store';
import { PencilIcon, TrashIcon } from '../../shared/ui/Icons';
import { KebabMenu } from '../../shared/ui/KebabMenu';
import { ChevronIcon, FileIcon, FolderIcon } from '../../shared/ui/ShapeIcons';

/** What is being dragged: `note:<id>` or `folder:<id>`. */
export const DRAG_TYPE = 'application/x-deck-memory';

interface FolderProps {
  folder: MemoryFolder;
  depth: number;
  open: boolean;
  selected: boolean;
  count: number;
  onToggle(): void;
  onRename(): void;
  onMove(): void;
  onDelete(): void;
  onDropped(payload: string): void;
}

export function FolderRow(p: FolderProps) {
  const t = useT();
  const [over, setOver] = useState(false);
  const drop = (event: DragEvent): void => {
    event.preventDefault();
    setOver(false);
    const payload = event.dataTransfer.getData(DRAG_TYPE);
    if (payload !== '') p.onDropped(payload);
  };
  return (
    <div
      className={`memory-row folder${p.selected ? ' selected' : ''}${over ? ' over' : ''}`}
      style={{ paddingLeft: 6 + p.depth * 16 }}
      draggable
      onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, `folder:${p.folder.id}`)}
      onDragOver={(e) => (e.preventDefault(), setOver(true))}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      <button type="button" className="memory-name" onClick={p.onToggle}>
        <ChevronIcon size={14} open={p.open} />
        <FolderIcon size={16} />
        <span>{p.folder.name}</span>
        <small className="hint">{p.count}</small>
      </button>
      <KebabMenu
        items={[
          { label: t('memory.rename'), icon: <PencilIcon size={16} />, onSelect: p.onRename },
          { label: t('memory.move'), onSelect: p.onMove },
          {
            label: t('memory.delete'),
            icon: <TrashIcon size={16} />,
            danger: true,
            onSelect: p.onDelete,
          },
        ]}
      />
    </div>
  );
}

interface NoteProps {
  note: MemoryEntry;
  depth: number;
  onEdit(): void;
  onToggle(): void;
  onMove(): void;
  onDelete(): void;
}

export function NoteRow({ note, depth, onEdit, onToggle, onMove, onDelete }: NoteProps) {
  const t = useT();
  const source =
    note.source === 'import'
      ? t('memory.source.import', { profile: note.importedFrom ?? '?' })
      : t(`memory.source.${note.source}`);
  return (
    <div
      className={`memory-row note${note.enabled ? '' : ' off'}`}
      style={{ paddingLeft: 24 + depth * 16 }}
      draggable
      onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, `note:${note.id}`)}
    >
      <button type="button" className="memory-name" onClick={onEdit}>
        <FileIcon size={16} />
        <span>{note.title}</span>
        <small className="badge">{source}</small>
        {!note.enabled && <small className="badge off">{t('memory.disabled')}</small>}
      </button>
      <KebabMenu
        items={[
          { label: t('memory.editNote'), icon: <PencilIcon size={16} />, onSelect: onEdit },
          { label: note.enabled ? t('memory.disable') : t('memory.enable'), onSelect: onToggle },
          { label: t('memory.move'), onSelect: onMove },
          {
            label: t('memory.delete'),
            icon: <TrashIcon size={16} />,
            danger: true,
            onSelect: onDelete,
          },
        ]}
      />
    </div>
  );
}
