import { WS_PATH, parseClientMessage, type ServerMessage } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { Container } from '../container.js';
import { eventToMessage, replayMessage } from './messages.js';

const CLOSE_NOT_FOUND = 4404;

export function terminalSocket(app: FastifyInstance, c: Container): void {
  app.get(`${WS_PATH}/:id`, { websocket: true }, (socket: WebSocket, request) => {
    const { id } = request.params as { id: string };
    const session = c.sessions.get(id);
    if (!session) return socket.close(CLOSE_NOT_FOUND, 'session not found');

    const queue: ServerMessage[] = [];
    let ready = false;
    const send = (message: ServerMessage): void => {
      if (!ready) queue.push(message);
      else if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
    };

    const unsubscribe = c.bus.subscribe((event) => {
      const message = eventToMessage(event, id);
      if (message) send(message);
    });
    socket.on('close', unsubscribe);

    socket.on('message', (raw) => {
      const message = parseClientMessage(raw.toString());
      if (!message) return;
      if (message.type === 'input') c.sessions.sendInput(id, message.data);
      else if (message.type === 'resize') c.sessions.resize(id, message.cols, message.rows);
      else send({ type: 'pong' });
    });

    void (async () => {
      const first: ServerMessage[] = [{ type: 'status', session }];
      const size = c.sessions.sizeOf(id);
      if (size) first.push({ type: 'size', ...size });
      const replay = await c.sessions.replay(id).catch(() => new Uint8Array());
      if (replay.byteLength > 0) first.push(replayMessage(replay));
      for (const pending of c.approvals.list('pending')) {
        if (pending.sessionId === id) first.push({ type: 'approval-request', request: pending });
      }
      ready = true;
      for (const message of [...first, ...queue.splice(0)]) send(message);
    })();
  });
}
