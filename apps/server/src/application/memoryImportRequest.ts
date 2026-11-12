import type { MemoryRequest, MemoryTree } from '@deck/shared';
import { invalid, notFound } from '../domain/errors.js';
import { folderPath, subtree } from './memoryFolders.js';

/**
 * What an agent's import asks the person to allow: the chosen notes (and every note inside the chosen folders)
 * of another profile, by title, so the person sees exactly what would be copied. The agent never sees the bodies.
 */
export function importRequest(
  from: MemoryTree,
  route: { fromProfile: string; toProfile: string },
  ids: readonly string[],
  folderIds: readonly string[],
): MemoryRequest {
  const folders = folderIds.map((id) => {
    if (!from.folders.some((f) => f.id === id)) throw notFound(`Folder ${id}`);
    return { id, name: folderPath(from, id) };
  });
  const inside = new Set(folderIds.flatMap((id) => [...subtree(from, id)]));
  if (ids.some((id) => !from.entries.some((e) => e.id === id))) throw notFound('One of the notes');
  const entries = from.entries
    .filter((e) => ids.includes(e.id) || (e.folderId !== null && inside.has(e.folderId)))
    .map((e) => ({ id: e.id, title: e.title }));
  if (entries.length === 0 && folders.length === 0) throw invalid('Nothing chosen to import');
  return { action: 'import', ...route, entries, folders };
}
