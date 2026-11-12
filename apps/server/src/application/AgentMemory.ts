import { CreateMemoryBodySchema, type MemoryTree } from '@deck/shared';
import { forbidden, invalid, notFound } from '../domain/errors.js';
import type { ProviderRegistry } from '../domain/provider.js';
import type { ApprovalService } from './ApprovalService.js';
import { findPath, folderPath } from './memoryFolders.js';
import { importRequest } from './memoryImportRequest.js';
import type { MemoryService } from './MemoryService.js';

export interface AgentMemoryDeps {
  memory: MemoryService;
  approvals: ApprovalService;
  providers: ProviderRegistry;
  /** The provider (profile) id of the calling session. */
  profileOf(sessionId: string): string;
  /** Shows a line in the chat of the session. */
  notice(sessionId: string, text: string): void;
}

const titles = (tree: MemoryTree, withState = false) =>
  tree.entries.map((e) => ({
    id: e.id,
    title: e.title,
    folder: folderPath(tree, e.folderId),
    ...(withState ? { enabled: e.enabled } : {}),
  }));

/** What an agent may do with the deck's memory, for ONE session: its own profile and the global notes. */
export function agentMemory(d: AgentMemoryDeps, sessionId: string) {
  const own = (): string => d.profileOf(sessionId);

  /** The folder at `path` of a profile's tree, made when it is missing. */
  async function folderAt(profileId: string, path: string): Promise<string | null> {
    let at: string | null = null;
    let walked = '';
    for (const name of path
      .split('/')
      .map((n) => n.trim())
      .filter((n) => n !== '')) {
      walked = walked ? `${walked}/${name}` : name;
      const found = findPath(d.memory.tree('profile', profileId), walked);
      at = found
        ? found.id
        : (await d.memory.folders.create({ scope: 'profile', profileId, name, parentId: at })).id;
    }
    return at;
  }

  return {
    /** Every profile by name, to know which one to ask for notes from. */
    profiles: () =>
      d.providers.list().map((p) => ({ id: p.id, label: p.label, you: p.id === own() })),

    /** Titles, ids and folders: the global notes and this profile's, or only the titles of another profile. */
    list: (scope?: 'global' | 'profile', profile?: string) => {
      if (profile && profile !== own())
        return { profile, titlesOnly: true, notes: titles(d.memory.tree('profile', profile)) };
      const global = { scope: 'global', notes: titles(d.memory.tree('global'), true) };
      const mine = {
        scope: 'profile',
        profile: own(),
        notes: titles(d.memory.tree('profile', own()), true),
      };
      return scope === 'global' ? [global] : scope === 'profile' ? [mine] : [global, mine];
    },

    /** A note of the global memory or of this profile, with its text. Another profile's is never readable. */
    read: (id: string) => {
      const entry = d.memory.entry(id);
      if (!entry) throw notFound(`Note ${id}`);
      if (entry.scope === 'profile' && entry.profileId !== own())
        throw forbidden("Another profile's notes can only be read after an approved import");
      return entry;
    },

    /** Saves (or updates, same title and folder) a note of this profile at once; a global note waits for approval. */
    write: async (input: {
      title: string;
      body: string;
      folder?: string | undefined;
      scope?: 'global' | 'profile' | undefined;
    }) => {
      const parsed = CreateMemoryBodySchema.safeParse({
        scope: input.scope ?? 'profile',
        profileId: own(),
        title: input.title,
        body: input.body,
      });
      if (!parsed.success) throw invalid(parsed.error.issues[0]?.message ?? 'Not a valid note');
      const { title, body } = parsed.data;
      if (parsed.data.scope === 'global') {
        const request = d.approvals.proposeMemory(
          sessionId,
          { action: 'write-global', title, body },
          `Add "${title}" to the global memory`,
        );
        return { status: 'pending approval', requestId: request.id };
      }
      const profileId = own();
      const folderId = await folderAt(profileId, input.folder ?? '');
      const same = d.memory
        .tree('profile', profileId)
        .entries.find((e) => e.title === title && e.folderId === folderId);
      const saved = same
        ? await d.memory.notes.update(same.id, { body })
        : await d.memory.notes.create(
            { scope: 'profile', profileId, folderId, title, body },
            'agent',
          );
      d.notice(sessionId, `Saved to memory: ${title}`);
      return { status: same ? 'updated' : 'saved', id: saved.id };
    },

    /** Asks the person to copy notes (and folders) of another profile into this one. */
    importFrom: (fromProfile: string, ids: string[] = [], folderIds: string[] = []) => {
      if (fromProfile === own()) throw invalid('That is your own profile');
      if (!d.providers.get(fromProfile)) throw notFound(`Profile ${fromProfile}`);
      const from = d.memory.tree('profile', fromProfile);
      const memory = importRequest(from, { fromProfile, toProfile: own() }, ids, folderIds);
      const count = memory.action === 'import' ? memory.entries.length : 0;
      const reason = `Copy ${count} note(s) from ${fromProfile} into ${own()}`;
      return {
        status: 'pending approval',
        requestId: d.approvals.proposeMemory(sessionId, memory, reason).id,
      };
    },

    /** Deletes a note of this profile (the global ones and other profiles' are not the agent's to delete). */
    delete: async (id: string) => {
      const entry = d.memory.entry(id);
      if (!entry) throw notFound(`Note ${id}`);
      if (entry.scope !== 'profile' || entry.profileId !== own())
        throw forbidden('Only notes of your own profile can be deleted');
      await d.memory.notes.delete(id);
      return { status: 'deleted' };
    },
  };
}

export type AgentMemoryTools = ReturnType<typeof agentMemory>;
