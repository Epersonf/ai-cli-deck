import { MEMORY_LIMITS, type MemoryFolder, type MemoryTree } from '@deck/shared';
import { conflict, invalid, notFound } from '../domain/errors.js';

export const emptyTree = (): MemoryTree => ({ folders: [], entries: [] });

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

export function folderOf(tree: MemoryTree, id: string): MemoryFolder {
  const folder = tree.folders.find((f) => f.id === id);
  if (!folder) throw notFound(`Folder ${id}`);
  return folder;
}

/** The folders from the top down to `id` (empty for the top of the scope). */
function chain(tree: MemoryTree, id: string | null): MemoryFolder[] {
  const out: MemoryFolder[] = [];
  for (let at = id; at !== null && out.length <= MEMORY_LIMITS.depth + 1;) {
    const folder = tree.folders.find((f) => f.id === at);
    if (!folder) break;
    out.unshift(folder);
    at = folder.parentId;
  }
  return out;
}

/** `Work/Notes` for a folder id; an empty text for the top. */
export const folderPath = (tree: MemoryTree, id: string | null): string =>
  chain(tree, id)
    .map((f) => f.name)
    .join('/');

/** How many folders are inside `id` on the longest branch (0: none). */
function heightBelow(tree: MemoryTree, id: string): number {
  const kids = tree.folders.filter((f) => f.parentId === id);
  return kids.length === 0 ? 0 : 1 + Math.max(...kids.map((k) => heightBelow(tree, k.id)));
}

function checkRoom(tree: MemoryTree, parentId: string | null, name: string, moving?: string): void {
  if (parentId !== null) folderOf(tree, parentId);
  const siblings = tree.folders.filter((f) => f.parentId === parentId && f.id !== moving);
  if (siblings.some((f) => same(f.name, name)))
    throw conflict(`A folder "${name}" is already there`);
  const below = moving ? 1 + heightBelow(tree, moving) : 1;
  if (chain(tree, parentId).length + below > MEMORY_LIMITS.depth)
    throw invalid(`Folders go at most ${MEMORY_LIMITS.depth} deep`);
}

export function addFolder(tree: MemoryTree, folder: MemoryFolder): MemoryTree {
  if (tree.folders.length >= MEMORY_LIMITS.folders)
    throw invalid(`At most ${MEMORY_LIMITS.folders} folders`);
  checkRoom(tree, folder.parentId, folder.name);
  return { ...tree, folders: [...tree.folders, folder] };
}

/** Renames and/or moves a folder; moving it into itself or its own sub-folders is refused. */
export function changeFolder(
  tree: MemoryTree,
  id: string,
  patch: { name?: string | undefined; parentId?: string | null | undefined },
): MemoryTree {
  const folder = folderOf(tree, id);
  const name = patch.name ?? folder.name;
  const parentId = patch.parentId === undefined ? folder.parentId : patch.parentId;
  if (parentId !== null && chain(tree, parentId).some((f) => f.id === id))
    throw invalid('A folder cannot move into itself');
  checkRoom(tree, parentId, name, id);
  const folders = tree.folders.map((f) => (f.id === id ? { ...f, name, parentId } : f));
  return { ...tree, folders };
}

/** The folder with every sub-folder below it. */
export function subtree(tree: MemoryTree, id: string): Set<string> {
  const ids = new Set([id]);
  for (let grew = true; grew;) {
    grew = false;
    for (const f of tree.folders)
      if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) grew = !!ids.add(f.id);
  }
  return ids;
}

/** Removes a folder with all its sub-folders and the notes inside them. */
export function dropFolder(tree: MemoryTree, id: string): MemoryTree {
  folderOf(tree, id);
  const gone = subtree(tree, id);
  return {
    folders: tree.folders.filter((f) => !gone.has(f.id)),
    entries: tree.entries.filter((e) => e.folderId === null || !gone.has(e.folderId)),
  };
}

/** The id of the folder at `path` (`Work/Notes`), or null when there is none; an empty path is the top. */
export function findPath(tree: MemoryTree, path: string): { id: string | null } | null {
  let at: string | null = null;
  for (const name of path
    .split('/')
    .map((n) => n.trim())
    .filter((n) => n !== '')) {
    const next: MemoryFolder | undefined = tree.folders.find(
      (f) => f.parentId === at && same(f.name, name),
    );
    if (!next) return null;
    at = next.id;
  }
  return { id: at };
}
