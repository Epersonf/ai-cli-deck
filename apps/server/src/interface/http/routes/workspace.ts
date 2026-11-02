import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const IdParams = z.object({ id: z.string().min(1) });
const TreeQuery = z.object({
  path: z.string().default(''),
  showIgnored: z.enum(['true', 'false']).default('false'),
});
const FileQuery = z.object({ path: z.string().min(1) });

export function workspaceRoutes(app: FastifyInstance, c: Container): void {
  app.get('/api/sessions/:id/tree', async (request) => {
    const { id } = parseWith(IdParams, request.params);
    const query = parseWith(TreeQuery, request.query);
    const entries = await c.workspace.tree(id, query.path, query.showIgnored === 'true');
    return { entries };
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
