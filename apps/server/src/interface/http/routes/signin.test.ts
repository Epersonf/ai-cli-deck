import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { service } from '../../../testing/signInKit.js';
import type { Container } from '../../container.js';
import { registerErrorHandler } from '../errors.js';
import { fsDirRoutes } from './fsDirs.js';
import { signInRoutes } from './signin.js';

async function app() {
  const s = service();
  const server = Fastify();
  registerErrorHandler(server);
  signInRoutes(server, { signIn: s.svc } as unknown as Container);
  fsDirRoutes(server);
  await server.ready();
  return { server, s };
}

describe('sign-in routes', () => {
  it('answers JSON null when no login exists, then the flow, and cancels with 204', async () => {
    const { server } = await app();
    const none = await server.inject('/api/providers/claude/login');
    expect(none.statusCode).toBe(200);
    expect(none.headers['content-type']).toContain('application/json');
    expect(JSON.parse(none.body)).toBeNull();
    const started = await server.inject({
      method: 'POST',
      url: '/api/providers/claude/login',
      payload: { method: 'claude-account' },
    });
    expect(started.json()).toMatchObject({ method: 'claude-account', state: 'running' });
    expect((await server.inject('/api/providers/claude/login')).json()).toMatchObject({
      state: 'running',
    });
    const input = await server.inject({
      method: 'POST',
      url: '/api/providers/claude/login/input',
      payload: { text: ' abc ' },
    });
    expect(input.statusCode).toBe(200);
    expect(
      (await server.inject({ method: 'DELETE', url: '/api/providers/claude/login' })).statusCode,
    ).toBe(204);
    expect((await server.inject('/api/providers/claude/login')).json()).toMatchObject({
      state: 'cancelled',
    });
  });

  it('reports who is signed in, refuses bad bodies and unknown providers, and lists folders', async () => {
    const { server } = await app();
    expect((await server.inject('/api/providers/claude/auth')).json()).toMatchObject({
      state: 'signed-out',
    });
    const bad = await server.inject({
      method: 'POST',
      url: '/api/providers/claude/login',
      payload: { method: 'x' },
    });
    expect(bad.statusCode).toBe(400);
    expect((await server.inject('/api/providers/nope/auth')).statusCode).toBe(404);
    expect(
      (await server.inject({ method: 'POST', url: '/api/providers/claude/logout' })).statusCode,
    ).toBe(204);
    const dirs = await server.inject('/api/fs/dirs');
    expect(dirs.json()).toMatchObject({ roots: expect.any(Array), dirs: expect.any(Array) });
    expect((await server.inject('/api/fs/dirs?path=relative')).statusCode).toBe(400);
  });
});
