import {
  CreateMemoryBodySchema,
  CreateMemoryFolderBodySchema,
  ImportMemoryBodySchema,
  MemoryScopeSchema,
  UpdateMemoryBodySchema,
  UpdateMemoryFolderBodySchema,
} from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const IdParams = z.object({ id: z.string().min(1) });
const TreeQuery = z.object({
  scope: MemoryScopeSchema,
  profileId: z.string().min(1).optional(),
});

/** The memory screen's API: notes and the folders they are organized in, global and per profile. */
export function memoryRoutes(app: FastifyInstance, c: Container): void {
  const { memory } = c;

  app.get('/api/memory', (request) => {
    const { scope, profileId } = parseWith(TreeQuery, request.query);
    return memory.tree(scope, profileId ?? null);
  });

  app.post('/api/memory', async (request, reply) =>
    reply
      .code(201)
      .send(await memory.notes.create(parseWith(CreateMemoryBodySchema, request.body))),
  );
  app.patch('/api/memory/:id', (request) =>
    memory.notes.update(
      parseWith(IdParams, request.params).id,
      parseWith(UpdateMemoryBodySchema, request.body),
    ),
  );
  app.delete('/api/memory/:id', async (request, reply) => {
    await memory.notes.delete(parseWith(IdParams, request.params).id);
    return reply.code(204).send();
  });

  app.post('/api/memory/folders', async (request, reply) =>
    reply
      .code(201)
      .send(await memory.folders.create(parseWith(CreateMemoryFolderBodySchema, request.body))),
  );
  app.patch('/api/memory/folders/:id', (request) =>
    memory.folders.update(
      parseWith(IdParams, request.params).id,
      parseWith(UpdateMemoryFolderBodySchema, request.body),
    ),
  );
  app.delete('/api/memory/folders/:id', async (request, reply) => {
    await memory.folders.delete(parseWith(IdParams, request.params).id);
    return reply.code(204).send();
  });

  // The person chose these notes themselves, so no approval is involved.
  app.post('/api/memory/import', (request) =>
    memory.importNotes(parseWith(ImportMemoryBodySchema, request.body)),
  );
}
