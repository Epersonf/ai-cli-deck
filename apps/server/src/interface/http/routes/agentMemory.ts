import { AGENT_PATH, MEMORY_LIMITS, MemoryScopeSchema } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createAgentTools } from '../../agent/agentTools.js';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const Params = z.object({ sessionId: z.string().min(1) });
const NoteParams = Params.extend({ id: z.string().min(1) });
const ListQuery = z.object({
  scope: MemoryScopeSchema.optional(),
  profile: z.string().min(1).optional(),
});
const WriteBody = z.object({
  title: z.string().min(1),
  body: z.string().default(''),
  folder: z.string().max(400).optional(),
  scope: MemoryScopeSchema.optional(),
});
const ImportBody = z.object({
  fromProfile: z.string().min(1),
  ids: z.array(z.string()).max(MEMORY_LIMITS.perScope).default([]),
  folderIds: z.array(z.string()).max(MEMORY_LIMITS.folders).default([]),
});

/** HTTP face of the agent's memory tool, used by `clideck memory`. Loopback only. */
export function agentMemoryRoutes(app: FastifyInstance, c: Container): void {
  const memory = (params: unknown) =>
    createAgentTools(c, parseWith(Params, params).sessionId).memory;
  const base = `${AGENT_PATH}/:sessionId/memory`;

  app.get(`${base}/profiles`, (request) => memory(request.params).profiles());
  app.get(base, (request) => {
    const { scope, profile } = parseWith(ListQuery, request.query);
    return memory(request.params).list(scope, profile);
  });
  app.get(`${base}/:id`, (request) =>
    memory(request.params).read(parseWith(NoteParams, request.params).id),
  );
  app.post(base, (request) => memory(request.params).write(parseWith(WriteBody, request.body)));
  app.delete(`${base}/:id`, (request) =>
    memory(request.params).delete(parseWith(NoteParams, request.params).id),
  );
  app.post(`${base}/import`, (request) => {
    const { fromProfile, ids, folderIds } = parseWith(ImportBody, request.body);
    return memory(request.params).importFrom(fromProfile, ids, folderIds);
  });
}
