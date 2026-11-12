import type { MemoryRequest } from '@deck/shared';
import type { MemoryService } from './MemoryService.js';

/** Does what an approved memory request asks: the only way an agent's global write or import happens. */
export async function applyMemoryRequest(
  memory: MemoryService,
  request: MemoryRequest,
): Promise<void> {
  if (request.action === 'write-global') {
    await memory.notes.create(
      { scope: 'global', title: request.title, body: request.body },
      'agent',
    );
  } else {
    await memory.importNotes({
      fromProfile: request.fromProfile,
      toProfile: request.toProfile,
      ids: request.entries.map((e) => e.id),
      folderIds: request.folders.map((f) => f.id),
    });
  }
}
