import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AgentTools } from '../agent/agentTools.js';
import { invalid } from '../../domain/errors.js';
import { runAsync } from './mcpResult.js';

const need = <T>(value: T | undefined, what: string): T => {
  if (value === undefined) throw invalid(`${what} is required`);
  return value;
};

/** The deck's memory as one tool: notes for every chat and for this profile. */
export function registerMemoryTool(server: McpServer, tools: AgentTools): void {
  const memory = tools.memory;
  server.registerTool(
    'memory',
    {
      description:
        "The deck's memory: notes the user keeps for every chat (global) and for this profile. " +
        'list (scope?, profile?, offset?, limit? default 50, max 100) returns a page with nextOffset and gives titles, ids and folder paths; with another profile it gives titles only. ' +
        'read (id) returns a note. write (title, body, folder? as "Work/Notes", scope? profile|global) saves a note of this profile now ' +
        '(the same title and folder is updated); a global note waits for the user to approve. delete (id) removes a note of your own profile. ' +
        'profiles lists the profiles; import (from_profile, ids?, folder_ids?) asks the user to copy chosen notes of another profile here ' +
        "(you cannot read another profile's notes before the user approves). New conversations receive updated briefings; read notes to refresh an existing chat.",
      inputSchema: {
        action: z
          .enum(['list', 'read', 'write', 'delete', 'profiles', 'import'])
          .optional()
          .describe('Omitted: write when a title is given, else list'),
        id: z.string().optional(),
        title: z.string().max(200).optional(),
        body: z.string().optional(),
        folder: z.string().max(400).optional(),
        scope: z.enum(['global', 'profile']).optional(),
        profile: z.string().optional(),
        offset: z.number().int().nonnegative().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        from_profile: z.string().optional(),
        ids: z.array(z.string()).optional(),
        folder_ids: z.array(z.string()).optional(),
      },
    },
    (a) =>
      runAsync(async () => {
        switch (a.action ?? (a.title === undefined ? 'list' : 'write')) {
          case 'profiles':
            return memory.profiles();
          case 'list':
            return memory.list(a.scope, a.profile, { offset: a.offset ?? 0, limit: a.limit ?? 50 });
          case 'read':
            return memory.read(need(a.id, 'id'));
          case 'delete':
            return memory.delete(need(a.id, 'id'));
          case 'import':
            return memory.importFrom(need(a.from_profile, 'from_profile'), a.ids, a.folder_ids);
          case 'write':
            return memory.write({
              title: need(a.title, 'title'),
              body: a.body ?? '',
              ...(a.folder === undefined ? {} : { folder: a.folder }),
              ...(a.scope === undefined ? {} : { scope: a.scope }),
            });
        }
      }),
  );
}
