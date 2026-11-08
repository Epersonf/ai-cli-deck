import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const Params = z.object({ token: z.string().min(8).max(64) });

/** The address behind a notification button (loopback only, like the other `/agent` routes; the secret is the token). */
export function notifyActionRoutes(app: FastifyInstance, c: Container): void {
  app.post('/agent/notify-action/:token', async (request, reply) => {
    const { token } = parseWith(Params, request.params);
    const done = (await c.approvalNotifier?.press(token)) ?? false;
    return done ? { ok: true } : reply.code(410).send({ error: 'This button is no longer valid' });
  });
}
