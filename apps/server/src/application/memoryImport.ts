import {
  MEMORY_LIMITS,
  type ImportMemoryBody,
  type MemoryEntry,
  type MemoryFolder,
  type MemoryTree,
} from '@deck/shared';
import { invalid, notFound } from '../domain/errors.js';
import { addFolder, findPath, folderPath, subtree } from './memoryFolders.js';

interface ImportJob {
  from: MemoryTree;
  to: MemoryTree;
  body: ImportMemoryBody;
  newId(): string;
  now: Date;
}

/** Makes the folders of `path` exist in `tree` (as they are, merging with folders of the same name). */
function ensurePath(
  tree: MemoryTree,
  path: string,
  profileId: string,
  newId: () => string,
): MemoryTree {
  let at: string | null = null;
  let next = tree;
  let walked = '';
  for (const name of path.split('/').filter((n) => n !== '')) {
    walked = walked ? `${walked}/${name}` : name;
    const have = findPath(next, walked);
    if (have) at = have.id;
    else {
      const folder: MemoryFolder = { id: newId(), scope: 'profile', profileId, name, parentId: at };
      next = addFolder(next, folder);
      at = folder.id;
    }
  }
  return next;
}

/**
 * The destination's memory after copying the chosen notes and whole folders of another profile into it. Each
 * note lands in a folder with the same path as in the source (made when missing); notes the destination already
 * has with the same title and body are skipped.
 */
export function importInto(job: ImportJob): MemoryTree {
  const { from, body, newId, now } = job;
  const wanted = new Set(body.ids);
  const folderIds = new Set<string>();
  for (const id of body.folderIds) {
    if (!from.folders.some((f) => f.id === id)) throw notFound(`Folder ${id}`);
    for (const inside of subtree(from, id)) folderIds.add(inside);
  }
  for (const id of body.ids)
    if (!from.entries.some((e) => e.id === id)) throw notFound(`Note ${id}`);
  const chosen = from.entries.filter(
    (e) => wanted.has(e.id) || (e.folderId !== null && folderIds.has(e.folderId)),
  );
  let to = job.to;
  for (const id of folderIds) to = ensurePath(to, folderPath(from, id), body.toProfile, newId);
  const have = new Set(to.entries.map((e) => `${e.title}\n${e.body}`));
  const added: MemoryEntry[] = [];
  for (const e of chosen) {
    if (have.has(`${e.title}\n${e.body}`)) continue;
    to = ensurePath(to, folderPath(from, e.folderId), body.toProfile, newId);
    const at = findPath(to, folderPath(from, e.folderId));
    added.push({
      ...e,
      id: newId(),
      profileId: body.toProfile,
      folderId: at?.id ?? null,
      source: 'import',
      importedFrom: body.fromProfile,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  }
  if (to.entries.length + added.length > MEMORY_LIMITS.perScope)
    throw invalid(`At most ${MEMORY_LIMITS.perScope} notes here`);
  return { ...to, entries: [...to.entries, ...added] };
}
