import { ChangePasswordBodySchema, LoginBodySchema } from '@deck/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { OtpRefused } from '../../../application/OtpAccess.js';
import { WrongPasswordError } from '../../../domain/errors.js';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';
import { clientKey, isLocalClient } from '../guards.js';

const tooMany = (reply: FastifyReply, wait: number) =>
  reply
    .code(429)
    .header('retry-after', wait)
    .send({ error: `Too many attempts. Try again in ${wait}s` });

/** Answers a refused one-time code: 401 with the tries left, or 429 with the wait while locked. */
export function otpRefusal(reply: FastifyReply, error: unknown): FastifyReply {
  if (!(error instanceof OtpRefused)) throw error;
  if (error.status === 401)
    return reply.code(401).send({ error: error.message, triesLeft: error.triesLeft });
  return reply
    .code(429)
    .header('retry-after', error.wait)
    .send({ error: error.message, wait: error.wait, locked: true });
}

/** Login handshake and password management; a correct login returns the access token. */
export function authRoutes(app: FastifyInstance, c: Container): void {
  // Answered per client: in OTP mode the machine itself is not asked to sign in.
  app.get('/api/auth', (request) => ({
    required: c.auth.requiredFor(isLocalClient(request)),
    canDisable: c.auth.canDisable,
    isDefault: c.auth.isDefault,
    mode: c.auth.mode,
  }));

  app.post('/api/login', (request, reply) => {
    if (!c.auth.requiredFor(isLocalClient(request))) return { token: null };
    if (c.auth.mode === 'otp') {
      // Anything but a right code (a password, nothing, a malformed code) is one wrong try.
      const { code } = (request.body ?? {}) as { code?: unknown };
      try {
        return {
          token: c.otp.login(clientKey(request), typeof code === 'string' ? code : undefined),
        };
      } catch (error) {
        return otpRefusal(reply, error);
      }
    }
    const key = request.ip;
    const wait = c.throttle.check(key);
    if (wait > 0) return tooMany(reply, wait);
    const { password } = parseWith(LoginBodySchema, request.body);
    if (password === undefined || !c.auth.verifyPassword(password)) {
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
