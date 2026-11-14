import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { describe, expect, it, vi } from 'vitest';
import type { ServerMessage } from '@deck/shared';
import { agentBody, createHarness } from '../../testing/harness.js';
import type { Container } from '../container.js';
import { chatSocket } from './chatSocket.js';

async function setup() {
  const h = createHarness();
  const { id } = await h.sessions.create(agentBody());
  const app = Fastify();
  await app.register(websocket);
  chatSocket(app, {
    sessions: h.sessions,
    bus: h.bus,
    approvals: { list: () => [] },
  } as unknown as Container);
  await app.ready();
  const socket = await app.injectWS(`/ws/sessions/${id}`);
  const messages: ServerMessage[] = [];
  socket.on('message', (raw) => messages.push(JSON.parse(raw.toString()) as ServerMessage));
  return { h, app, socket, messages };
}

describe('chat input failures', { timeout: 20_000 }, () => {
  it.each([false, true])('shows a rejected send (queued: %s)', async (queue) => {
    const { h, app, socket, messages } = await setup();
    try {
      vi.spyOn(h.sessions, queue ? 'sendOrQueue' : 'send').mockRejectedValueOnce(
        new Error('Unable to start this message'),
      );
      socket.send(JSON.stringify({ type: 'send', text: 'hello', queue, seq: 1 }));
      await vi.waitFor(() => {
        expect(messages).toContainEqual({
          type: 'event',
          event: { t: 'notice', level: 'error', text: 'Unable to start this message' },
        });
      });
      expect(messages).toContainEqual({ type: 'ack', seq: 1 });
    } finally {
      socket.close();
      await app.close();
    }
  });

  it('shows a failure to send a queued message now', async () => {
    const { h, app, socket, messages } = await setup();
    try {
      vi.spyOn(h.sessions, 'queueNow').mockRejectedValueOnce(new Error('Queued send failed'));
      socket.send(JSON.stringify({ type: 'queue-now', id: 'queued' }));
      await vi.waitFor(() => {
        expect(messages).toContainEqual({
          type: 'event',
          event: { t: 'notice', level: 'error', text: 'Queued send failed' },
        });
      });
    } finally {
      socket.close();
      await app.close();
    }
  });
});
