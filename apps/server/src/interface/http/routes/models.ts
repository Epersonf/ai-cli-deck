import { SetDefaultModelBodySchema } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notFound } from '../../../domain/errors.js';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const IdParams = z.object({ id: z.string().min(1) });

/** The model a provider (or profile) answers with when a chat has not picked one. */
export function modelRoutes(app: FastifyInstance, c: Container): void {
  app.put('/api/providers/:id/default-model', (request, reply) => {
    const { id } = parseWith(IdParams, request.params);
    const { model } = parseWith(SetDefaultModelBodySchema, request.body);
    if (!c.providers.get(id)) throw notFound(`Provider ${id}`);
    c.models.setDefault(id, model);
    return reply.code(204).send();
  });
}
