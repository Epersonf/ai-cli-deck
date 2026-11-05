import { WS_PATH, parseClientMessage, type ServerMessage } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { Container } from '../container.js';
import { eventToMessage, outputFrame } from './messages.js';

const CLOSE_NOT_FOUND = 4404;
/** A device this far behind is cut off; it reconnects and gets a fresh screen instead of a backlog. */
const CLOSE_TOO_SLOW = 4408;
const MAX_BUFFERED_BYTES = 8 * 1024 * 1024;

export function terminalSocket(app: FastifyInstance, c: Container): void {
  app.get(`${WS_PATH}/:id`, { websocket: true }, (socket: WebSocket, request) => {
    const { id } = request.params as { id: string };
    const session = c.sessions.get(id);
    if (!session) return socket.close(CLOSE_NOT_FOUND, 'session not found');

    const open = (): boolean => socket.readyState === socket.OPEN;
    const json = (message: ServerMessage): void => {
      if (open()) socket.send(JSON.stringify(message));
    };
    const bytes = (data: Uint8Array, replay = false): void => {
      if (!open()) return;
      if (socket.bufferedAmount <= MAX_BUFFERED_BYTES) socket.send(outputFrame(data, replay));
      else socket.close(CLOSE_TOO_SLOW, 'too far behind');
    };

    // Until the screen snapshot is taken, output is already part of it and other messages wait.
    let synced = false;
    const held: ServerMessage[] = [];
    const unsubscribe = c.bus.subscribe((event) => {
      if (event.kind === 'output') {
        if (synced && event.sessionId === id) bytes(event.data);
        return;
      }
      const message = eventToMessage(event, id);
      if (message && synced) json(message);
      else if (message) held.push(message);
    });
    socket.on('close', unsubscribe);

    // The terminal can be removed while a device is still connected to it: tell that device, never throw
    // (an exception in a socket handler would take the whole deck down).
    const gone = (): boolean => {
      if (c.sessions.get(id)) return false;
      socket.close(CLOSE_NOT_FOUND, 'session not found');
      return true;
    };

    socket.on('message', (raw) => {
      const message = parseClientMessage(raw.toString());
      if (!message || gone()) return;
      if (message.type === 'input') c.sessions.sendInput(id, message.data);
      else if (message.type === 'resize') c.sessions.resize(id, message.cols, message.rows);
      else json({ type: 'pong' });
    });

    c.sessions.snapshot(id, (screen) => {
      if (gone()) return;
      json({ type: 'status', session: c.sessions.get(id) ?? session });
      const size = c.sessions.sizeOf(id);
      if (size) json({ type: 'size', ...size });
      if (screen.byteLength > 0) bytes(screen, true);
      for (const pending of c.approvals.list('pending')) {
        if (pending.sessionId === id) json({ type: 'approval-request', request: pending });
      }
      // Status and size were just sent as they are now; anything older would only go backwards.
      for (const message of held.splice(0)) {
        if (message.type !== 'status' && message.type !== 'size') json(message);
      }
      synced = true;
    });
  });
}
