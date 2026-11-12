import Fastify from 'fastify';
import { LoginThrottle } from '../application/LoginThrottle.js';
import { registerErrorHandler } from '../interface/http/errors.js';
import { registerSecurity } from '../interface/http/security.js';
import { authRoutes } from '../interface/http/routes/auth.js';
import { authOtpRoutes } from '../interface/http/routes/authOtp.js';
import type { Container } from '../interface/container.js';
import { otpKit } from './otpKit.js';

/** The auth routes behind the real guard, called as a client at any address. */
export const LAN = '192.168.1.20';

export async function app() {
  const kit = await otpKit();
  const c = {
    auth: kit.auth,
    otp: kit.otp,
    throttle: new LoginThrottle(() => 0),
  } as unknown as Container;
  const server = Fastify();
  registerErrorHandler(server);
  registerSecurity(server, {
    bindHost: '0.0.0.0',
    allowedOrigins: [],
    isValidToken: (token, local) => kit.auth.isValidToken(token, local),
  });
  authRoutes(server, c);
  authOtpRoutes(server, c);
  server.get('/api/ping', () => ({ pong: true }));
  await server.ready();
  const send = (
    method: 'GET' | 'POST' | 'PUT',
    url: string,
    o: { from?: string; token?: string; body?: object; headers?: Record<string, string> } = {},
  ) =>
    server.inject({
      method,
      url,
      remoteAddress: o.from ?? LAN,
      headers: { ...(o.token ? { 'x-deck-token': o.token } : {}), ...o.headers },
      ...(o.body ? { payload: o.body } : {}),
    });
  // Turns OTP on from the machine itself with the static token.
  async function enable() {
    const token = kit.auth.accessToken ?? '';
    const { secret } = (await send('GET', '/api/auth/otp', { token })).json();
    const res = await send('PUT', '/api/auth/mode', {
      token,
      body: { mode: 'otp', code: kit.codeOf(secret) },
    });
    return { secret, token: res.json().token as string, res };
  }
  return { send, kit, enable };
}
