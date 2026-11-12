import { MEMORY_LIMITS, type MemoryEntry, type MemoryFolder } from '@deck/shared';

export interface FolderNode {
  folder: MemoryFolder;
  folders: FolderNode[];
  entries: MemoryEntry[];
}

export interface RootNode {
  folders: FolderNode[];
  entries: MemoryEntry[];
}

const byName = (a: MemoryFolder, b: MemoryFolder): number => a.name.localeCompare(b.name);
const byTitle = (a: MemoryEntry, b: MemoryEntry): number => a.title.localeCompare(b.title);

/** Folders nested under their parents, notes inside their folder; both sorted by name. */
export function buildTree(
  folders: readonly MemoryFolder[],
  entries: readonly MemoryEntry[],
): RootNode {
  const build = (parentId: string | null): FolderNode[] =>
    folders
      .filter((f) => f.parentId === parentId)
      .sort(byName)
      .map((folder) => ({
        folder,
        folders: build(folder.id),
        entries: entries.filter((e) => e.folderId === folder.id).sort(byTitle),
      }));
  return {
    folders: build(null),
    entries: entries.filter((e) => e.folderId === null).sort(byTitle),
  };
}

/** The names from the top of the scope down to a folder (empty for the top). */
export function pathOf(folders: readonly MemoryFolder[], id: string | null): MemoryFolder[] {
  const path: MemoryFolder[] = [];
  let at = id === null ? undefined : folders.find((f) => f.id === id);
  while (at && path.length <= MEMORY_LIMITS.depth + 1) {
    path.unshift(at);
    const parent: string | null = at.parentId;
    at = parent === null ? undefined : folders.find((f) => f.id === parent);
  }
  return path;
}

/** The ids of a folder and everything below it. */
export function subtreeIds(folders: readonly MemoryFolder[], id: string): string[] {
  const kids = folders.filter((f) => f.parentId === id).flatMap((f) => subtreeIds(folders, f.id));
  return [id, ...kids];
}

/** How many notes live in a folder and its sub-folders. */
export const countNotes = (
  folders: readonly MemoryFolder[],
  entries: readonly MemoryEntry[],
  id: string,
): number => {
  const ids = new Set(subtreeIds(folders, id));
  return entries.filter((e) => e.folderId !== null && ids.has(e.folderId)).length;
};

const heightOf = (folders: readonly MemoryFolder[], id: string): number =>
  1 + Math.max(0, ...folders.filter((f) => f.parentId === id).map((f) => heightOf(folders, f.id)));

export type MoveVerdict = { ok: true } | { ok: false; reason: 'self' | 'child' | 'depth' };

/** Whether a folder may move under `target` (null: the top): not into itself or below itself, and not too deep. */
export function canMoveFolder(
  folders: readonly MemoryFolder[],
  id: string,
  target: string | null,
): MoveVerdict {
  if (target === id) return { ok: false, reason: 'self' };
  if (target !== null && subtreeIds(folders, id).includes(target)) {
    return { ok: false, reason: 'child' };
  }
  const targetDepth = pathOf(folders, target).length;
  if (targetDepth + heightOf(folders, id) > MEMORY_LIMITS.depth) {
    return { ok: false, reason: 'depth' };
  }
  return { ok: true };
}

/** Characters of the enabled notes (title and body), as the agent's briefing counts them. */
export const briefingUsed = (entries: readonly MemoryEntry[]): number =>
  entries.filter((e) => e.enabled).reduce((sum, e) => sum + e.title.length + e.body.length, 0);

/** Every folder, indented by depth, for a picker. */
export function flatFolders(
  folders: readonly MemoryFolder[],
): { folder: MemoryFolder; depth: number }[] {
  const walk = (
    parentId: string | null,
    depth: number,
  ): { folder: MemoryFolder; depth: number }[] =>
    folders
      .filter((f) => f.parentId === parentId)
      .sort(byName)
      .flatMap((folder) => [{ folder, depth }, ...walk(folder.id, depth + 1)]);
  return walk(null, 0);
}
