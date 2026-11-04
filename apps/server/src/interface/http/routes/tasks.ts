import { NotifyIdleBodySchema } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notFound } from '../../../domain/errors.js';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const IdParams = z.object({ id: z.string().min(1) });

/** What the user sees of the background tasks: the list, a task's output, stop/clear, and "notify when quiet". */
export function taskRoutes(app: FastifyInstance, c: Container): void {
  app.get('/api/tasks', () => c.tasks.board.list());

  app.get('/api/tasks/:id/log', (request) => ({
    text: c.tasks.log(parseWith(IdParams, request.params).id),
  }));

  // Stops a running task; a finished one is cleared from the list.
  app.delete('/api/tasks/:id', async (request, reply) => {
    const { id } = parseWith(IdParams, request.params);
    c.tasks.board.remove(id);
    return reply.code(204).send();
  });

  app.post('/api/sessions/:id/notify-idle', (request) => {
    const { id } = parseWith(IdParams, request.params);
    const { on } = parseWith(NotifyIdleBodySchema, request.body);
    const owner = c.sessions.get(id);
    if (!owner) throw notFound(`Session ${id}`);
    return { task: c.tasks.setIdle(owner, on) ?? null };
  });
}
