import { ForkSessionBodySchema } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const IdParams = z.object({ id: z.string().min(1) });

/** Forking or moving a chat: the user's action; the running agent is asked for its handoff notes first. */
export function forkRoutes(app: FastifyInstance, c: Container): void {
  const idOf = (params: unknown): string => parseWith(IdParams, params).id;

  app.post('/api/sessions/:id/handoff/request', async (request, reply) => {
    await c.handoffs.request(idOf(request.params));
    return reply.code(204).send();
  });

  // The web polls this to see whether the agent has written its notes yet.
  app.get('/api/sessions/:id/handoff', async (request) => ({
    info: await c.handoffs.info(idOf(request.params)),
  }));

  app.post('/api/sessions/:id/fork', async (request, reply) => {
    const body = parseWith(ForkSessionBodySchema, request.body ?? {});
    return reply.code(201).send(await c.handoffs.fork(idOf(request.params), body));
  });
}
