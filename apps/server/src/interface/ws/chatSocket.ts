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
    const inputFailed = (error: unknown): void => {
      const text = error instanceof Error ? error.message : 'The message could not be sent';
      request.log.error({ err: error, sessionId: id }, 'Chat input failed');
      json({ type: 'event', event: { t: 'notice', level: 'error', text } });
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
    const leave = (): void => c.viewers?.drop(id, socket);
    socket.on('close', unsubscribe);
    socket.on('close', leave);
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
        if (fresh) {
          const go = message.queue ? c.sessions.sendOrQueue : c.sessions.send;
          void go.call(c.sessions, id, message.text, message.images).catch(inputFailed);
        }
        if (message.seq !== undefined) json({ type: 'ack', seq: message.seq });
      } else if (message.type === 'interrupt') c.sessions.interrupt(id);
      else if (message.type === 'queue-now')
        void c.sessions.queueNow(id, message.id).catch(inputFailed);
      else if (message.type === 'queue-drop') c.sessions.queueDrop(id, message.id);
      else if (message.type === 'permission') {
        c.sessions.answer(id, message.id, {
          allow: message.allow,
          ...(message.always !== undefined && { always: message.always }),
          ...(message.message !== undefined && { message: message.message }),
          ...(message.answers !== undefined && { answers: message.answers }),
        });
      } else if (message.type === 'config') {
        c.sessions.configure(id, {
          ...(message.model !== undefined && { model: message.model }),
          ...(message.mode !== undefined && { mode: message.mode }),
          ...(message.effort !== undefined && { effort: message.effort }),
          ...(message.autoCompact !== undefined && { autoCompact: message.autoCompact }),
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
      else if (message.type === 'compact') void c.sessions.compact(id).catch(inputFailed);
      else if (message.type === 'usage-refresh') void c.sessions.refreshLimits(id);
      else if (message.type === 'viewing') c.viewers?.set(id, socket, message.viewing);
      else json({ type: 'pong', lag: loopLagMs() });
    });

    void c.sessions
      .snapshot(id)
      .then((chat) => {
        if (gone()) return;
        json({ type: 'status', session: c.sessions.get(id) ?? session });
        json({ type: 'replay', ...chat });
        json({ type: 'usage', usage: c.sessions.usage(id) });
        json({ type: 'queue', items: c.sessions.queued(id) });
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
