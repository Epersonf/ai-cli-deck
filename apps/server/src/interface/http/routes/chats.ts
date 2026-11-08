import {
  ForkSessionBodySchema,
  OpenChatBodySchema,
  RestartSessionBodySchema,
  type SessionChat,
} from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { toInfo } from '../../../application/ChatService.js';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const IdParams = z.object({ id: z.string().min(1) });
const ListQuery = z.object({ provider: z.string().min(1), cwd: z.string().min(1) });

/** Conversations: what a terminal can continue, restarting, forking or moving them, and the saved ones. */
export function chatRoutes(app: FastifyInstance, c: Container): void {
  const idOf = (params: unknown): string => parseWith(IdParams, params).id;

  app.get('/api/sessions/:id/chat', async (request): Promise<SessionChat> => {
    const id = idOf(request.params);
    const screen = await c.sessions.replay(id);
    return c.chats.info(id, screen.byteLength > 0);
  });

  app.post('/api/sessions/:id/restart', async (request, reply) => {
    const body = parseWith(RestartSessionBodySchema, request.body ?? {});
    await c.chatActions.restart(idOf(request.params), body);
    return reply.code(204).send();
  });

  app.post('/api/sessions/:id/fork', async (request, reply) => {
    const body = parseWith(ForkSessionBodySchema, request.body ?? {});
    return reply.code(201).send(await c.chatActions.fork(idOf(request.params), body));
  });

  app.get('/api/chats/titles', () => c.chats.titles());

  app.get('/api/chats', async (request) => {
    const { provider, cwd } = parseWith(ListQuery, request.query);
    return (await c.chats.list(provider, c.resolveCwd(cwd))).map(toInfo);
  });

  app.post('/api/chats/open', async (request, reply) => {
    const body = parseWith(OpenChatBodySchema, request.body);
    const opened = await c.chatActions.open({ ...body, cwd: c.resolveCwd(body.cwd) });
    return reply.code(201).send(opened);
  });
}
