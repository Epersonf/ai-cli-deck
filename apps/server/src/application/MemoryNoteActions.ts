import {
  MEMORY_LIMITS,
  type CreateMemoryBody,
  type MemoryEntry,
  type MemoryScope,
} from '@deck/shared';
import { invalid, notFound } from '../domain/errors.js';
import { folderOf } from './memoryFolders.js';
import type { MemoryService } from './MemoryService.js';

export type MemorySource = MemoryEntry['source'];

const defined = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

/** Writing, editing and deleting notes of the memory. */
export class MemoryNoteActions {
  constructor(
    private readonly memory: MemoryService,
    private readonly newId: () => string,
    private readonly now: () => Date,
  ) {}

  create(body: CreateMemoryBody, source: MemorySource = 'user'): Promise<MemoryEntry> {
    const scope: MemoryScope = body.scope;
    const profileId = scope === 'global' ? null : (body.profileId ?? null);
    return this.memory.change(scope, profileId, (tree) => {
      if (tree.entries.length >= MEMORY_LIMITS.perScope)
        throw invalid(`At most ${MEMORY_LIMITS.perScope} notes here`);
      const folderId = body.folderId ?? null;
      if (folderId !== null) folderOf(tree, folderId);
      const at = this.now().toISOString();
      const entry: MemoryEntry = {
        id: this.newId(),
        scope,
        profileId,
        folderId,
        title: body.title.trim(),
        body: body.body ?? '',
        enabled: true,
        source,
        importedFrom: null,
        createdAt: at,
        updatedAt: at,
      };
      return { tree: { ...tree, entries: [...tree.entries, entry] }, result: entry };
    });
  }

  update(
    id: string,
    patch: {
      title?: string | undefined;
      body?: string | undefined;
      enabled?: boolean | undefined;
      folderId?: string | null | undefined;
    },
  ): Promise<MemoryEntry> {
    const found = this.memory.entry(id);
    if (!found) return Promise.reject(notFound(`Note ${id}`));
    return this.memory.change(found.scope, found.profileId, (tree) => {
      if (patch.folderId) folderOf(tree, patch.folderId);
      const next: MemoryEntry = {
        ...found,
        ...(defined(patch) as Partial<MemoryEntry>),
        updatedAt: this.now().toISOString(),
      };
      return {
        tree: { ...tree, entries: tree.entries.map((e) => (e.id === id ? next : e)) },
        result: next,
      };
    });
  }

  delete(id: string): Promise<void> {
    const found = this.memory.entry(id);
    if (!found) return Promise.reject(notFound(`Note ${id}`));
    return this.memory.change(found.scope, found.profileId, (tree) => ({
      tree: { ...tree, entries: tree.entries.filter((e) => e.id !== id) },
      result: undefined,
    }));
  }
}
