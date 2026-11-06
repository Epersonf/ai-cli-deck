import type { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { readPath, writePath } from '../../../infrastructure/machine/fileTransfer.js';
import { parseWith } from '../errors.js';

const ReadQuery = z.object({ path: z.string().min(1).max(4000) });
const WriteQuery = ReadQuery.extend({
  kind: z.enum(['file', 'dir']).default('file'),
  /** The file's name, used when `path` is a folder. */
  name: z.string().min(1).max(255).default('file'),
});

/**
 * Any file or folder of this machine, for agents moving work between devices (through a link, or `here`).
 * A folder travels as a tar archive and is unpacked on arrival. Same trust as the deck's terminals.
 */
export function fileRoutes(app: FastifyInstance): void {
  app.get('/api/files', async (request, reply) => {
    const out = await readPath(parseWith(ReadQuery, request.query).path);
    reply.header('x-deck-kind', out.kind).header('x-deck-name', encodeURIComponent(out.name));
    if (out.size !== null) reply.header('content-length', out.size);
    return reply.type('application/octet-stream').send(out.body);
  });

  app.put('/api/files', async (request) => {
    const { path, kind, name } = parseWith(WriteQuery, request.query);
    return { path: await writePath(path, kind, name, request.body as Readable) };
  });
}
