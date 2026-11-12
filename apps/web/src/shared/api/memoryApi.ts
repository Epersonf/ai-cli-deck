import {
  MemoryEntrySchema,
  MemoryFolderSchema,
  MemoryTreeSchema,
  type CreateMemoryBody,
  type ImportMemoryBody,
  type MemoryScope,
} from '@deck/shared';
import { z } from 'zod';
import { request } from './client';

const enc = encodeURIComponent;

/** The deck's memory: notes in nestable folders, per scope (global, or one profile). */
export const memoryApi = {
  tree: (scope: MemoryScope, profileId: string | null) =>
    request(
      MemoryTreeSchema,
      'GET',
      `/api/memory?scope=${scope}${profileId === null ? '' : `&profileId=${enc(profileId)}`}`,
    ),
  createNote: (body: CreateMemoryBody) => request(MemoryEntrySchema, 'POST', '/api/memory', body),
  updateNote: (
    id: string,
    body: { title?: string; body?: string; enabled?: boolean; folderId?: string | null },
  ) => request(MemoryEntrySchema, 'PATCH', `/api/memory/${enc(id)}`, body),
  deleteNote: (id: string) => request(z.void(), 'DELETE', `/api/memory/${enc(id)}`),
  createFolder: (body: {
    scope: MemoryScope;
    profileId: string | null;
    name: string;
    parentId: string | null;
  }) => request(MemoryFolderSchema, 'POST', '/api/memory/folders', body),
  updateFolder: (id: string, body: { name?: string; parentId?: string | null }) =>
    request(MemoryFolderSchema, 'PATCH', `/api/memory/folders/${enc(id)}`, body),
  deleteFolder: (id: string) => request(z.void(), 'DELETE', `/api/memory/folders/${enc(id)}`),
  importNotes: (body: ImportMemoryBody) =>
    request(MemoryTreeSchema, 'POST', '/api/memory/import', body),
};
