import {
  SignInInputBodySchema,
  StartSignInBodySchema,
  type AuthInfo,
  type SignInFlow,
} from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const IdParams = z.object({ id: z.string().min(1) });

/** Signing in without a terminal: start a login, follow it, paste its code, cancel, sign out, ask who is in. */
export function signInRoutes(app: FastifyInstance, c: Container): void {
  const idOf = (params: unknown): string => parseWith(IdParams, params).id;

  app.post('/api/providers/:id/login', async (request): Promise<SignInFlow> => {
    const { method } = parseWith(StartSignInBodySchema, request.body);
    return c.signIn.start(idOf(request.params), method);
  });

  app.get('/api/providers/:id/login', (request): SignInFlow | null =>
    c.signIn.current(idOf(request.params)),
  );

  app.post('/api/providers/:id/login/input', (request): SignInFlow => {
    const { text } = parseWith(SignInInputBodySchema, request.body);
    return c.signIn.input(idOf(request.params), text);
  });

  app.delete('/api/providers/:id/login', (request, reply) => {
    c.signIn.cancel(idOf(request.params));
    return reply.code(204).send();
  });

  app.post('/api/providers/:id/logout', async (request, reply) => {
    await c.signIn.logout(idOf(request.params));
    return reply.code(204).send();
  });

  app.get('/api/providers/:id/auth', (request): Promise<AuthInfo> =>
    c.signIn.auth(idOf(request.params)),
  );
}
