import { ExecBodySchema, TerminalInputBodySchema, type ScreenText } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const IdParams = z.object({ id: z.string().min(1) });
const ScreenQuery = z.object({ lines: z.coerce.number().int().min(1).max(500).default(60) });

/**
 * The machine for agents (this deck's, or a paired deck's through a link): run a command and wait for it,
 * message a chat session, and read a session's recent conversation as text.
 */
export function machineRoutes(app: FastifyInstance, c: Container): void {
  const idOf = (params: unknown): string => parseWith(IdParams, params).id;

  app.post('/api/exec', (request) => c.machine.exec(parseWith(ExecBodySchema, request.body)));

  // A message to the session's agent (`enter` is accepted for older callers and ignored).
  app.post('/api/sessions/:id/input', async (request, reply) => {
    const id = idOf(request.params);
    const { text } = parseWith(TerminalInputBodySchema, request.body);
    if (!c.sessions.get(id)) return reply.code(404).send({ error: 'Session not found' });
    if (text.trim()) await c.sessions.send(id, text);
    return reply.code(204).send();
  });

  // The recent conversation as text (`cols` and `rows` are 0: there is no screen).
  app.get('/api/sessions/:id/screen', async (request, reply): Promise<ScreenText | undefined> => {
    const id = idOf(request.params);
    if (!c.sessions.get(id)) return reply.code(404).send({ error: 'Session not found' });
    const { lines } = parseWith(ScreenQuery, request.query);
    return { text: await c.sessions.recent(id, lines), cols: 0, rows: 0 };
  });
}
