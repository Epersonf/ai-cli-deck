import { CreateSessionBodySchema } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const IdParams = z.object({ id: z.string().min(1) });
const PreviewBody = z.object({ url: z.string().min(1) });

export function sessionRoutes(app: FastifyInstance, c: Container): void {
  app.get('/api/config', () => c.publicConfig);

  app.get('/api/providers', () => c.providers.list().map(({ id, label }) => ({ id, label })));

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

  app.put('/api/sessions/:id/preview', (request) => {
    const { id } = parseWith(IdParams, request.params);
    const { url } = parseWith(PreviewBody, request.body);
    return { url: c.sessions.setPreview(id, url) };
  });
}
