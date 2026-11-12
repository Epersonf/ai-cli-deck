import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { createHarness } from '../../../testing/harness.js';
import type { Container } from '../../container.js';
import { registerErrorHandler } from '../errors.js';
import { modelRoutes } from './models.js';
import { taskRoutes } from './tasks.js';

async function app() {
  const h = createHarness();
  const server = Fastify();
  registerErrorHandler(server);
  const c = {
    providers: h.providers,
    models: h.models,
    sessions: h.sessions,
  } as unknown as Container;
  modelRoutes(server, c);
  taskRoutes(server, c);
  await server.ready();
  return { server, h };
}
const put = (server: Awaited<ReturnType<typeof app>>['server'], id: string, payload: unknown) =>
  server.inject({
    method: 'PUT',
    url: `/api/providers/${id}/default-model`,
    payload: payload as object,
  });

describe('default model route', () => {
  it('sets and clears the default with 204, and refuses an unknown provider or a bad body', async () => {
    const { server, h } = await app();
    expect((await put(server, 'claude', { model: 'opus' })).statusCode).toBe(204);
    expect(h.models.defaultOf('claude')).toBe('opus');
    expect((await put(server, 'claude', { model: null })).statusCode).toBe(204);
    expect(h.models.defaultOf('claude')).toBeNull();
    expect((await put(server, 'nope', { model: 'x' })).statusCode).toBe(404);
    expect((await put(server, 'claude', { model: '' })).statusCode).toBe(400);
  });

  it('keeps answering 204 to the old notify-idle call, doing nothing', async () => {
    const { server } = await app();
    const res = await server.inject({
      method: 'POST',
      url: '/api/sessions/s1/notify-idle',
      payload: { on: true },
    });
    expect(res.statusCode).toBe(204);
  });
});
