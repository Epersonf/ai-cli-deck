import { WS_PATH, parseClientMessage, type ServerMessage } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { Container } from '../container.js';
import { acceptInput } from './inputDedup.js';
import { loopLagMs } from './loopLag.js';
import { eventToMessage } from './messages.js';

const CLOSE_NOT_FOUND = 4404;

/** One device's view of a session's conversation: the whole chat on connect, then every step as it happens. */
export function chatSocket(app: FastifyInstance, c: Container): void {
  app.get(`${WS_PATH}/:id`, { websocket: true }, (socket: WebSocket, request) => {
    const { id } = request.params as { id: string };
    const session = c.sessions.get(id);
    if (!session) return socket.close(CLOSE_NOT_FOUND, 'session not found');

    const json = (message: ServerMessage): void => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
    };
    // Until the conversation is sent, live steps wait: they would arrive before what they follow.
    let synced = false;
    const held: ServerMessage[] = [];
    const unsubscribe = c.bus.subscribe((event) => {
      const message = eventToMessage(event, id);
      if (!message) return;
      if (synced) json(message);
      else held.push(message);
    });
    socket.on('close', unsubscribe);
    socket.on('error', unsubscribe);

    // The session can be removed while a device is still connected: tell that device, never throw.
    const gone = (): boolean => {
      if (c.sessions.get(id)) return false;
      socket.close(CLOSE_NOT_FOUND, 'session not found');
      return true;
    };

    socket.on('message', (raw) => {
      const message = parseClientMessage(raw.toString());
      if (!message || gone()) return;
      if (message.type === 'send') {
        const fresh =
          message.cid === undefined ||
          message.seq === undefined ||
          acceptInput(`${id}:${message.cid}`, message.seq);
        if (fresh) void c.sessions.send(id, message.text, message.images).catch(() => undefined);
        if (message.seq !== undefined) json({ type: 'ack', seq: message.seq });
      } else if (message.type === 'interrupt') c.sessions.interrupt(id);
      else if (message.type === 'permission') {
        c.sessions.answer(id, message.id, {
          allow: message.allow,
          ...(message.always !== undefined && { always: message.always }),
          ...(message.message !== undefined && { message: message.message }),
        });
      } else if (message.type === 'config') {
          ...(message.answers !== undefined && { answers: message.answers }),
        c.sessions.configure(id, {
          ...(message.model !== undefined && { model: message.model }),
          ...(message.mode !== undefined && { mode: message.mode }),
          ...(message.effort !== undefined && { effort: message.effort }),
        });
      } else if (message.type === 'rewind') {
        const { id: messageId, text, images, revertFiles } = message;
        c.sessions
          .rewind(id, {
            messageId,
            text,
            images,
            ...(revertFiles !== undefined && { revertFiles }),
          })
          .catch((error: unknown) => {
            const reason =
              error instanceof Error ? error.message : 'The message could not be edited';
            json({ type: 'event', event: { t: 'notice', level: 'error', text: reason } });
          });
      } else if (message.type === 'stop-task') c.sessions.stopTask(id, message.id);
      else json({ type: 'pong', lag: loopLagMs() });
    });

    void c.sessions
      .snapshot(id)
      .then((chat) => {
        if (gone()) return;
        json({ type: 'status', session: c.sessions.get(id) ?? session });
        json({ type: 'replay', ...chat });
        json({ type: 'usage', usage: c.sessions.usage(id) });
        for (const pending of c.approvals.list('pending')) {
          if (pending.sessionId === id) json({ type: 'approval-request', request: pending });
        }
        // What was just sent is the state now; a status or config before it would go backwards.
        for (const message of held.splice(0)) {
          if (message.type !== 'status' && message.type !== 'config') json(message);
        }
        synced = true;
      })
      .catch(() => socket.close(CLOSE_NOT_FOUND, 'session not found'));
  });
}
