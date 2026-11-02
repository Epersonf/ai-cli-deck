import {
  CreateProfileBodySchema,
  CreateSessionBodySchema,
  RenameSessionBodySchema,
} from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const IdParams = z.object({ id: z.string().min(1) });
const PreviewBody = z.object({ url: z.string().min(1) });

export function sessionRoutes(app: FastifyInstance, c: Container): void {
  app.get('/api/config', () => c.publicConfig);

  app.get('/api/providers', () =>
    Promise.all(
      c.providers
        .list()
        .map(async ({ id, label }) => ({ id, label, ...(await c.providerStatus(id)) })),
    ),
  );

  app.get('/api/sessions', () => c.sessions.list());

  app.post('/api/sessions', async (request, reply) => {
    const body = parseWith(CreateSessionBodySchema, request.body);
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
    await c.addProfile(parseWith(CreateProfileBodySchema, request.body));
    return reply.code(201).send({ ok: true });
  });

  app.put('/api/sessions/:id/preview', (request) => {
    const { id } = parseWith(IdParams, request.params);
    const { url } = parseWith(PreviewBody, request.body);
    return { url: c.sessions.setPreview(id, url) };
  });
}
