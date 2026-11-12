import { MEMORY_LIMITS, type MemoryEntry, type MemoryScope } from '@deck/shared';
import { useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { PlusIcon } from '../../shared/ui/Icons';
import { FolderIcon } from '../../shared/ui/ShapeIcons';
import { MemoryBranch } from './MemoryBranch';
import { DRAG_TYPE } from './MemoryRows';
import { briefingUsed, buildTree, pathOf } from './memoryTree';
import { MovePicker } from './MovePicker';
import { NamePrompt } from './NamePrompt';
import { NoteEditor } from './NoteEditor';
import { useExplorerActions, type Moving, type Naming } from './useExplorerActions';
import { useMemoryView } from './useMemoryView';

interface Props {
  scope: MemoryScope;
  profileId: string | null;
}

/** The folders and notes of one scope: expand, organise by drag and drop or "Move to...", edit, delete. */
export function MemoryExplorer({ scope, profileId }: Props) {
  const t = useT();
  const view = useMemoryView(scope, profileId);
  const { tree } = view;
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [current, setCurrent] = useState<string | null>(null);
  const [editing, setEditing] = useState<MemoryEntry | 'new' | null>(null);
  const [moving, setMoving] = useState<Moving>(null);
  const [naming, setNaming] = useState<Naming>(null);

  const root = buildTree(tree.folders, tree.entries);
  const path = pathOf(tree.folders, current);
  const used = briefingUsed(tree.entries);

  const toggle = (id: string): void => {
    setCurrent(id);
    setOpen((now) => new Set(now.has(id) ? [...now].filter((x) => x !== id) : [...now, id]));
  };
  const act = useExplorerActions(scope, profileId, view, current);

  return (
    <div className={`memory-explorer${editing === null ? '' : ' editing'}`}>
      <div className="memory-left">
        <nav className="memory-crumbs" aria-label="path">
          <button type="button" onClick={() => setCurrent(null)}>
            {t('memory.top')}
          </button>
          {path.map((f) => (
            <button key={f.id} type="button" onClick={() => setCurrent(f.id)}>
              / {f.name}
            </button>
          ))}
        </nav>
        <div className="row memory-tools">
          <button type="button" className="primary" onClick={() => setEditing('new')}>
            <PlusIcon size={16} /> {t('memory.newNote')}
          </button>
          <button
            type="button"
            disabled={tree.folders.length >= MEMORY_LIMITS.folders}
            onClick={() => setNaming('new')}
          >
            <FolderIcon size={16} /> {t('memory.newFolder')}
          </button>
        </div>
        {view.error !== null && <p className="notice error">{view.error}</p>}
        <div
          className="memory-tree"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const payload = e.dataTransfer.getData(DRAG_TYPE);
            if (payload !== '' && e.target === e.currentTarget) act.drop(payload, null);
          }}
        >
          {tree.entries.length + tree.folders.length === 0 && !view.loading && (
            <p className="empty">
              {t(scope === 'global' ? 'memory.emptyGlobal' : 'memory.emptyProfile')}
            </p>
          )}
          <MemoryBranch
            node={root}
            depth={0}
            view={{ ...view, open, current }}
            onToggle={toggle}
            onDrop={act.drop}
            onEdit={setEditing}
            onMove={setMoving}
            onNameFolder={(folder) => setNaming({ rename: folder })}
            onDeleteFolder={act.deleteFolder}
            onDeleteNote={act.deleteNote}
          />
        </div>
        <p className={`hint memory-budget${used > MEMORY_LIMITS.briefing ? ' over' : ''}`}>
          {t('memory.budget', { used, max: MEMORY_LIMITS.briefing })}
          {used > MEMORY_LIMITS.briefing && ` ${t('memory.budgetOver')}`}
        </p>
      </div>
      <div className="memory-right">
        {editing === null ? (
          <p className="empty">{t('memory.pickNote')}</p>
        ) : (
          <NoteEditor
            key={editing === 'new' ? 'new' : editing.id}
            note={editing === 'new' ? null : editing}
            onSave={(draft) => act.saveNote(editing, draft)}
            onClose={() => setEditing(null)}
          />
        )}
      </div>
      {moving !== null && (
        <MovePicker
          folders={tree.folders}
          moving={'folder' in moving ? moving.folder : null}
          onPick={(target) => (act.moveTo(moving, target), setMoving(null))}
          onClose={() => setMoving(null)}
        />
      )}
      {naming !== null && (
        <NamePrompt
          title={naming === 'new' ? t('memory.newFolder') : t('memory.rename')}
          initial={naming === 'new' ? '' : naming.rename.name}
          onSubmit={(value) => (act.nameFolder(naming, value), setNaming(null))}
          onClose={() => setNaming(null)}
        />
      )}
    </div>
  );
}
