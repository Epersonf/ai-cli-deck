import { basename } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { collectEntries, zipStream } from '../../../infrastructure/fs/zipStream.js';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';
import { attachment } from './raw.js';

const IdParams = z.object({ id: z.string().min(1) });
const TreeQuery = z.object({
  path: z.string().default(''),
  hidden: z.enum(['true', 'false']).default('false'),
  ignored: z.enum(['true', 'false']).default('false'),
});
const FileQuery = z.object({ path: z.string().min(1) });

export function workspaceRoutes(app: FastifyInstance, c: Container): void {
  app.get('/api/sessions/:id/tree', async (request) => {
    const { id } = parseWith(IdParams, request.params);
    const query = parseWith(TreeQuery, request.query);
    const entries = await c.workspace.tree(id, query.path, {
      hidden: query.hidden === 'true',
      ignored: query.ignored === 'true',
    });
    return { entries };
  });

  // A folder as a streamed .zip (no .git / node_modules, symlinks skipped).
  app.get('/api/sessions/:id/zip', async (request, reply) => {
    const { id } = parseWith(IdParams, request.params);
    const { path } = parseWith(z.object({ path: z.string().default('') }), request.query);
    const dir = await c.workspace.resolveDir(id, path);
    const name = basename(dir) || 'folder';
    const entries = await collectEntries(dir, name);
    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', attachment(`${name}.zip`))
      .header('cache-control', 'no-store')
      .send(zipStream(entries));
  });

  app.get('/api/sessions/:id/file', (request) => {
    const { id } = parseWith(IdParams, request.params);
    const { path } = parseWith(FileQuery, request.query);
    return c.workspace.read(id, path);
  });

  app.get('/api/sessions/:id/git', (request) => {
    const { id } = parseWith(IdParams, request.params);
    return c.workspace.gitStatus(id);
  });
}
