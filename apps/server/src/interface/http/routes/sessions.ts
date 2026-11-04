import {
  CreateProfileBodySchema,
  CreateSessionBodySchema,
  RenameProfileBodySchema,
  RenameSessionBodySchema,
} from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { removeProfile } from '../../../application/removeProfile.js';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const IdParams = z.object({ id: z.string().min(1) });
const PreviewBody = z.object({ url: z.string().min(1) });

export function sessionRoutes(app: FastifyInstance, c: Container): void {
  app.get('/api/config', () => c.publicConfig);

  app.get('/api/providers', () =>
    Promise.all(
      c.providers.list().map(async ({ id, label }) => ({
        id,
        label,
        profile: c.profiles.has(id),
        ...(await c.providerStatus(id)),
      })),
    ),
  );

  app.get('/api/sessions', () => c.sessions.list());

  app.post('/api/sessions', async (request, reply) => {
    const body = parseWith(CreateSessionBodySchema, request.body);
    // parentId is only ever set by the sub-terminal route below.
    return reply.code(201).send(await c.sessions.create({ ...body, parentId: null }));
  });

  // A plain shell in a folder of this session (inside its root), as a sub-terminal: for git, tests, anything by hand.
  app.post('/api/sessions/:id/terminal', async (request, reply) => {
    const { id } = parseWith(IdParams, request.params);
    const { path } = parseWith(z.object({ path: z.string().default('') }), request.body ?? {});
    const cwd = await c.workspace.resolveDir(id, path);
    const body = {
      provider: 'shell',
      cwd,
      useWorktree: false,
      command: null,
      args: [],
      parentId: id,
    };
    return reply.code(201).send(await c.sessions.create(body));
  });

  app.delete('/api/sessions/:id', async (request, reply) => {
    const { id } = parseWith(IdParams, request.params);
    await c.sessions.remove(id);
    return reply.code(204).send();
  });

  app.patch('/api/sessions/:id', async (request) => {
    const { id } = parseWith(IdParams, request.params);
    const { name } = parseWith(RenameSessionBodySchema, request.body);
    return c.sessions.rename(id, name);
  });

  app.post('/api/profiles', async (request, reply) => {
    const body = parseWith(CreateProfileBodySchema, request.body);
    return reply.code(201).send(await c.profiles.create(body));
  });

  app.delete('/api/profiles/:id', async (request) => {
    const { id } = parseWith(IdParams, request.params);
    return removeProfile(c, id);
  });

  app.patch('/api/profiles/:id', async (request) => {
    const { id } = parseWith(IdParams, request.params);
    const { label } = parseWith(RenameProfileBodySchema, request.body);
    return c.profiles.rename(id, label);
  });

  app.put('/api/sessions/:id/preview', (request) => {
    const { id } = parseWith(IdParams, request.params);
    const { url } = parseWith(PreviewBody, request.body);
    return { url: c.sessions.setPreview(id, url) };
  });
}
