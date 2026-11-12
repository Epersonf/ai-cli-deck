import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { listDirs } from '../../../infrastructure/fs/listDirs.js';
import { parseWith } from '../errors.js';

const Query = z.object({ path: z.string().max(4096).default('') });

/** Folders of the machine the deck runs on, for choosing where a session works. */
export function fsDirRoutes(app: FastifyInstance): void {
  app.get('/api/fs/dirs', (request) => listDirs(parseWith(Query, request.query).path));
}
