import type { MemoryTree } from '@deck/shared';
import type { MemoryService } from './MemoryService.js';
import { folderPath } from './memoryFolders.js';

export interface MemoryPage {
  offset: number;
  limit: number;
}

const titles = (tree: MemoryTree, withState = false) =>
  tree.entries.map((e) => ({
    id: e.id,
    title: e.title,
    folder: folderPath(tree, e.folderId),
    ...(withState ? { enabled: e.enabled } : {}),
  }));

export function memoryListing(
  memory: MemoryService,
  own: string,
  scope?: 'global' | 'profile',
  profile?: string,
  page?: MemoryPage,
) {
  const paginate = (
    groups: Array<{ scope: string; profile?: string; notes: ReturnType<typeof titles> }>,
  ) => {
    if (!page) return groups;
    const all = groups.flatMap((group) =>
      group.notes.map((note) => ({
        ...note,
        scope: group.scope,
        ...(group.profile ? { profile: group.profile } : {}),
      })),
    );
    const offset = Math.max(0, Math.floor(page.offset));
    const limit = Math.max(1, Math.min(100, Math.floor(page.limit)));
    return {
      notes: all.slice(offset, offset + limit),
      total: all.length,
      nextOffset: offset + limit < all.length ? offset + limit : null,
    };
  };
  if (profile && profile !== own)
    return page
      ? {
          titlesOnly: true,
          ...paginate([
            { scope: 'profile', profile, notes: titles(memory.tree('profile', profile)) },
          ]),
        }
      : { profile, titlesOnly: true, notes: titles(memory.tree('profile', profile)) };
  const global = { scope: 'global', notes: titles(memory.tree('global'), true) };
  const mine = {
    scope: 'profile',
    profile: own,
    notes: titles(memory.tree('profile', own), true),
  };
  return paginate(scope === 'global' ? [global] : scope === 'profile' ? [mine] : [global, mine]);
}
