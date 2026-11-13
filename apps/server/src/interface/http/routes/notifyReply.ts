import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const Params = z.object({ token: z.string().min(8).max(64) });
const Body = z.object({ text: z.string().trim().min(1).max(20_000) });

/** The address behind a notification's Reply box (loopback only, like the other `/agent` routes; the secret is the token). */
export function notifyReplyRoutes(app: FastifyInstance, c: Container): void {
  app.post('/agent/reply/:token', async (request, reply) => {
    const { token } = parseWith(Params, request.params);
    const { text } = parseWith(Body, request.body);
    const sessionId = c.replyLinks?.resolve(token) ?? null;
    if (sessionId === null || !c.sessions.get(sessionId))
      return reply.code(410).send({ error: 'This reply box is no longer valid' });
    // Typed while the agent works: it waits in the chat's queue, like in the app.
    await c.sessions.sendOrQueue(sessionId, text);
    return { ok: true };
  });
}
