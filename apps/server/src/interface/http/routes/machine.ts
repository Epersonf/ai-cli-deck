import { ExecBodySchema, TerminalInputBodySchema, type ScreenText } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const IdParams = z.object({ id: z.string().min(1) });
const ScreenQuery = z.object({ lines: z.coerce.number().int().min(1).max(500).default(60) });
/** The text first, Enter a moment later: CLIs read a fast burst ending in Enter as a paste. */
const ENTER_AFTER_MS = 300;
const FALLBACK_SIZE = { cols: 120, rows: 40 };

/**
 * The machine for agents (this deck's, or a paired deck's through a link): run a command and wait for it,
 * type into a terminal, and read a terminal's screen as text.
 */
export function machineRoutes(app: FastifyInstance, c: Container): void {
  const idOf = (params: unknown): string => parseWith(IdParams, params).id;

  app.post('/api/exec', (request) => c.machine.exec(parseWith(ExecBodySchema, request.body)));

  app.post('/api/sessions/:id/input', (request, reply) => {
    const id = idOf(request.params);
    const { text, enter } = parseWith(TerminalInputBodySchema, request.body);
    if (!c.sessions.get(id)) return reply.code(404).send({ error: 'Terminal not found' });
    if (text) c.sessions.sendInput(id, text);
    if (enter)
      setTimeout(
        () => c.sessions.get(id) && c.sessions.sendInput(id, '\r'),
        text ? ENTER_AFTER_MS : 0,
      );
    return reply.code(204).send();
  });

  app.get('/api/sessions/:id/screen', async (request, reply): Promise<ScreenText | undefined> => {
    const id = idOf(request.params);
    if (!c.sessions.get(id)) return reply.code(404).send({ error: 'Terminal not found' });
    const { lines } = parseWith(ScreenQuery, request.query);
    const size = c.sessions.sizeOf(id) ?? FALLBACK_SIZE;
    const text = await c.machine.screenText(await c.sessions.replay(id), size, lines);
    return { text, ...size };
  });
}
