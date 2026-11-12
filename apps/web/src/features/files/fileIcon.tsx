import { mediaKindOf } from '@deck/shared';
import { FileIcon, FolderIcon, type FileKind } from '../../shared/ui/ShapeIcons';

const KINDS: Record<ReturnType<typeof mediaKindOf>, FileKind> = {
  image: 'image',
  audio: 'audio',
  video: 'video',
  pdf: 'pdf',
  text: 'text',
};

/** The picture of a file or folder in the explorer. */
export function EntryIcon({ name, kind }: { name: string; kind: 'file' | 'dir' }) {
  return kind === 'dir' ? (
    <FolderIcon size={16} />
  ) : (
    <FileIcon size={16} kind={KINDS[mediaKindOf(name)]} />
  );
}
