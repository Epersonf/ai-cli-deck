import { z } from 'zod';

/**
 * The deck's own memory, kept as notes the agents are told about at the start of every chat.
 *  - `global`: shared by every profile and chat.
 *  - `profile`: shared by the chats of one profile (its id is the provider id: a profile's, or `claude`/`codex`).
 * A chat's own memory is its conversation. Profiles are separate worlds: a profile's notes reach another
 * profile only by an import the person authorized.
 */
export const MemoryScopeSchema = z.enum(['global', 'profile']);
export type MemoryScope = z.infer<typeof MemoryScopeSchema>;

export const MEMORY_LIMITS = {
  title: 80,
  body: 4000,
  /** Notes per scope. */
  perScope: 200,
  folderName: 60,
  folders: 100,
  /** Folders inside folders, at most this deep. */
  depth: 5,
  /** Characters of notes put straight into an agent's briefing; the rest is listed by title only. */
  briefing: 8000,
} as const;

/** A folder the person organizes notes in (nestable). It only exists to organise: agents see its path. */
export const MemoryFolderSchema = z.object({
  id: z.string(),
  scope: MemoryScopeSchema,
  profileId: z.string().nullable(),
  name: z.string().trim().min(1).max(MEMORY_LIMITS.folderName),
  /** The folder it sits in; null: the top of the scope. */
  parentId: z.string().nullable(),
});
export type MemoryFolder = z.infer<typeof MemoryFolderSchema>;

export const CreateMemoryFolderBodySchema = z.object({
  scope: MemoryScopeSchema,
  profileId: z.string().min(1).nullable().default(null),
  name: z.string().trim().min(1).max(MEMORY_LIMITS.folderName),
  parentId: z.string().nullable().default(null),
});
/** Rename and/or move a folder (a folder cannot move into itself or its own sub-folders). */
export const UpdateMemoryFolderBodySchema = z.object({
  name: z.string().trim().min(1).max(MEMORY_LIMITS.folderName).optional(),
  parentId: z.string().nullable().optional(),
});

export const MemoryEntrySchema = z.object({
  id: z.string(),
  scope: MemoryScopeSchema,
  /** The provider id the note belongs to; null for `global`. */
  profileId: z.string().nullable(),
  /** The folder it is in; null: the top of the scope. */
  folderId: z.string().nullable().default(null),
  title: z.string().trim().min(1).max(MEMORY_LIMITS.title),
  body: z.string().max(MEMORY_LIMITS.body),
  /** A disabled note is kept but not shown to agents. */
  enabled: z.boolean().default(true),
  /** Who wrote it: the person, an agent (saved by itself), or an import from another profile. */
  source: z.enum(['user', 'agent', 'import']).default('user'),
  /** For an import: the profile it came from. */
  importedFrom: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

export const CreateMemoryBodySchema = z.object({
  scope: MemoryScopeSchema,
  profileId: z.string().min(1).nullable().default(null),
  folderId: z.string().nullable().default(null),
  title: z.string().trim().min(1).max(MEMORY_LIMITS.title),
  body: z.string().max(MEMORY_LIMITS.body).default(''),
});
export type CreateMemoryBody = z.input<typeof CreateMemoryBodySchema>;

export const UpdateMemoryBodySchema = z.object({
  title: z.string().trim().min(1).max(MEMORY_LIMITS.title).optional(),
  body: z.string().max(MEMORY_LIMITS.body).optional(),
  enabled: z.boolean().optional(),
  /** Move to a folder (null: the top). Must be a folder of the same scope and profile. */
  folderId: z.string().nullable().optional(),
});

/** The whole memory of one scope: folders and notes, for the memory screen. */
export const MemoryTreeSchema = z.object({
  folders: z.array(MemoryFolderSchema),
  entries: z.array(MemoryEntrySchema),
});
export type MemoryTree = z.infer<typeof MemoryTreeSchema>;

/** Copies notes of one profile into another (the person asked for it, so no further approval). */
export const ImportMemoryBodySchema = z.object({
  fromProfile: z.string().min(1),
  toProfile: z.string().min(1),
  ids: z.array(z.string()).max(MEMORY_LIMITS.perScope).default([]),
  /** Also import whole folders (with everything inside and the folder structure). */
  folderIds: z.array(z.string()).max(MEMORY_LIMITS.folders).default([]),
});
export type ImportMemoryBody = z.infer<typeof ImportMemoryBodySchema>;

/** What an approval of kind `memory` asks the person to allow (see ApprovalRequest.memory). */
export const MemoryRequestSchema = z.discriminatedUnion('action', [
  /** An agent wants notes of `fromProfile` copied into `toProfile` (its own profile). */
  z.object({
    action: z.literal('import'),
    fromProfile: z.string(),
    toProfile: z.string(),
    entries: z.array(z.object({ id: z.string(), title: z.string() })),
    folders: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
  }),
  /** An agent wants to write a note into the global memory (writes to its own profile need no approval). */
  z.object({
    action: z.literal('write-global'),
    title: z.string(),
    body: z.string(),
  }),
]);
export type MemoryRequest = z.infer<typeof MemoryRequestSchema>;
