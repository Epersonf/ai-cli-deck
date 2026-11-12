import { SetAuthModeBodySchema } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';
import { clientKey, isLocalClient } from '../guards.js';
import { otpRefusal } from './auth.js';

const RotateBody = z.object({ code: z.string().max(12).optional() });

/**
 * Setting up and switching to one-time codes. All of it needs a signed-in device (the guard checks the token;
 * this machine counts as signed in while OTP is on). Wrong codes here count against `mode:<client>`.
 */
export function authOtpRoutes(app: FastifyInstance, c: Container): void {
  const status = (request: Parameters<typeof isLocalClient>[0]) => ({
    required: c.auth.requiredFor(isLocalClient(request)),
    canDisable: c.auth.canDisable,
    isDefault: c.auth.isDefault,
    mode: c.auth.mode,
  });

  // The pending secret while OTP is off (made on the first call), the one in use when it is on.
  app.get('/api/auth/otp', () => c.otp.setup());

  app.post('/api/auth/otp/rotate', async (request, reply) => {
    const { code } = parseWith(RotateBody, request.body ?? {});
    try {
      return await c.otp.rotate(`mode:${clientKey(request)}`, code);
    } catch (error) {
      return otpRefusal(reply, error);
    }
  });

  // Answers the new status, and `token`: the access token to use from now on (a new one after a switch to OTP).
  app.put('/api/auth/mode', async (request, reply) => {
    const body = parseWith(SetAuthModeBodySchema, request.body);
    try {
      const token = await c.otp.switchMode(`mode:${clientKey(request)}`, body);
      return { ...status(request), token };
    } catch (error) {
      return otpRefusal(reply, error);
    }
  });
}
