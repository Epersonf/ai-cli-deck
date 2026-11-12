import type { MemoryFolder, MemoryScope } from '@deck/shared';
import { notFound } from '../domain/errors.js';
import { addFolder, changeFolder, dropFolder, folderOf } from './memoryFolders.js';
import type { MemoryService } from './MemoryService.js';

/** Making, renaming, moving and deleting the folders notes are organized in. */
export class MemoryFolderActions {
  constructor(
    private readonly memory: MemoryService,
    private readonly newId: () => string,
  ) {}

  create(body: {
    scope: MemoryScope;
    profileId?: string | null;
    name: string;
    parentId?: string | null;
  }): Promise<MemoryFolder> {
    const profileId = body.scope === 'global' ? null : (body.profileId ?? null);
    return this.memory.change(body.scope, profileId, (tree) => {
      const folder: MemoryFolder = {
        id: this.newId(),
        scope: body.scope,
        profileId,
        name: body.name.trim(),
        parentId: body.parentId ?? null,
      };
      return { tree: addFolder(tree, folder), result: folder };
    });
  }

  private holder(id: string): { scope: MemoryScope; profileId: string | null } {
    const found = this.memory.holderOfFolder(id);
    if (!found) throw notFound(`Folder ${id}`);
    return found;
  }

  /** Renames and/or moves a folder (never into itself or its own sub-folders). */
  update(
    id: string,
    patch: { name?: string | undefined; parentId?: string | null | undefined },
  ): Promise<MemoryFolder> {
    const { scope, profileId } = this.holder(id);
    return this.memory.change(scope, profileId, (tree) => {
      const next = changeFolder(tree, id, patch);
      return { tree: next, result: folderOf(next, id) };
    });
  }

  /** Deletes the folder with everything inside it. */
  delete(id: string): Promise<void> {
    const { scope, profileId } = this.holder(id);
    return this.memory.change(scope, profileId, (tree) => ({
      tree: dropFolder(tree, id),
      result: undefined,
    }));
  }
}
