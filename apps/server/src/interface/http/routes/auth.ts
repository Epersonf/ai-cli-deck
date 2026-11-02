import { ChangePasswordBodySchema, LoginBodySchema } from '@deck/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { WrongPasswordError } from '../../../domain/errors.js';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const tooMany = (reply: FastifyReply, wait: number) =>
  reply
    .code(429)
    .header('retry-after', wait)
    .send({ error: `Too many attempts. Try again in ${wait}s` });

/** Password handshake and password management; a correct login returns the access token. */
export function authRoutes(app: FastifyInstance, c: Container): void {
  app.get('/api/auth', () => ({
    required: c.auth.required,
    canDisable: c.auth.canDisable,
    isDefault: c.auth.isDefault,
  }));

  app.post('/api/login', (request, reply) => {
    if (!c.auth.required) return { token: null };
    const key = request.ip;
    const wait = c.throttle.check(key);
    if (wait > 0) return tooMany(reply, wait);
    const { password } = parseWith(LoginBodySchema, request.body);
    if (!c.auth.verifyPassword(password)) {
      c.throttle.fail(key);
      return reply.code(401).send({ error: 'Wrong password' });
    }
    c.throttle.succeed(key);
    return { token: c.auth.accessToken };
  });

  app.put('/api/password', async (request, reply) => {
    const key = `password:${request.ip}`;
    const wait = c.throttle.check(key);
    if (wait > 0) return tooMany(reply, wait);
    const body = parseWith(ChangePasswordBodySchema, request.body);
    try {
      const token = await c.auth.change(body.current, body.next);
      c.throttle.succeed(key);
      return { token };
    } catch (error) {
      if (error instanceof WrongPasswordError) c.throttle.fail(key);
      throw error;
    }
  });
}
