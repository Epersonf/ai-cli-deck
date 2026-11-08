import { EVENTS_WS_PATH, type PushMessage } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { Container } from '../container.js';
import type { DeckEvent } from '../../domain/events.js';

function toPush(event: DeckEvent): PushMessage | null {
  switch (event.kind) {
    case 'session':
      return { type: 'session', session: event.session };
    case 'approval':
      return { type: 'approval', request: event.request };
    case 'exit':
      return { type: 'exit', sessionId: event.sessionId, code: event.code };
    default:
      return null;
  }
}

/** Session and approval changes for the whole deck, pushed as they happen (terminal output is not here). */
export function eventsSocket(app: FastifyInstance, c: Container): void {
  app.get(EVENTS_WS_PATH, { websocket: true }, (socket: WebSocket) => {
    const unsubscribe = c.bus.subscribe((event) => {
      const message = toPush(event);
      if (message && socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
    });
    const send = (message: PushMessage): void => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
    };
    const stopActivity = c.activity?.subscribe((a) => send({ type: 'activity', ...a }));
    for (const a of c.activity?.snapshot() ?? []) send({ type: 'activity', ...a });
    const stop = (): void => {
      unsubscribe();
      stopActivity?.();
    };
    socket.on('close', stop);
    socket.on('error', stop);
    // Browsers cannot answer a ping frame from script, so a text ping/pong keeps the link honest.
    socket.on('message', () => {
      if (socket.readyState === socket.OPEN) socket.send('{"type":"pong"}');
    });
  });
}
