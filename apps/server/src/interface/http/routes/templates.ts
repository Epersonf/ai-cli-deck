import { ImportTemplateBodySchema } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TEMPLATE_SKELETON } from '../../../infrastructure/providers/templateSkeleton.js';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const IdParams = z.object({ id: z.string().min(1) });

/** Profile templates: list, import a file, remove an imported one, and the commented example to start from. */
export function templateRoutes(app: FastifyInstance, c: Container): void {
  app.get('/api/templates', () => c.templates.list());

  app.get('/api/templates/skeleton', () => ({ text: TEMPLATE_SKELETON }));

  app.post('/api/templates', async (request, reply) => {
    const { text } = parseWith(ImportTemplateBodySchema, request.body);
    return reply.code(201).send(await c.templates.install(text));
  });

  app.delete('/api/templates/:id', async (request, reply) => {
    await c.templates.remove(parseWith(IdParams, request.params).id);
    return reply.code(204).send();
  });
}
