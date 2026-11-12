import type { MemoryFolder } from '@deck/shared';
import { useT } from '../../shared/i18n/store';
import { FolderIcon } from '../../shared/ui/ShapeIcons';
import { canMoveFolder, flatFolders, type MoveVerdict } from './memoryTree';

interface Props {
  folders: readonly MemoryFolder[];
  /** When a folder is being moved: it cannot go into itself or below itself, or too deep. */
  moving: MemoryFolder | null;
  onPick(target: string | null): void;
  onClose(): void;
}

/** "Move to...": the folders of the scope as a list (works by touch, no dragging). */
export function MovePicker({ folders, moving, onPick, onClose }: Props) {
  const t = useT();
  return (
    <div className="modal-backdrop confirm-backdrop sheet" onClick={onClose}>
      <div className="modal move-picker" onClick={(e) => e.stopPropagation()}>
        <h2>{t('memory.moveTitle')}</h2>
        <ul className="folder-list">
          <li>
            <button type="button" className="folder-enter" onClick={() => onPick(null)}>
              <FolderIcon size={16} /> {t('memory.top')}
            </button>
          </li>
          {flatFolders(folders).map(({ folder, depth }) => {
            const verdict: MoveVerdict = moving
              ? canMoveFolder(folders, moving.id, folder.id)
              : { ok: true };
            return (
              <li key={folder.id}>
                <button
                  type="button"
                  className="folder-enter"
                  style={{ paddingLeft: 10 + depth * 16 }}
                  disabled={!verdict.ok}
                  title={verdict.ok ? undefined : t(`memory.move.${verdict.reason}`)}
                  onClick={() => onPick(folder.id)}
                >
                  <FolderIcon size={16} /> {folder.name}
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={onClose}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
