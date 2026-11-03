import { ServerMessageSchema, TOKEN_QUERY, WS_PATH } from '@deck/shared';
import type { ClientMessage, ServerMessage } from '@deck/shared';
import { getToken } from '../api/token';

export interface SocketHandlers {
  onOpen(): void;
  onMessage(message: ServerMessage): void;
  onClose(): void;
}

export interface TerminalSocket {
  send(message: ClientMessage): void;
  close(): void;
}

const NOT_FOUND_CLOSE = 4404;
const PING_MS = 25_000;
/** Typed input older than this is not replayed after a reconnect (it would surprise the user). */
const OUTBOX_MAX_AGE_MS = 15_000;

function socketUrl(sessionId: string): string {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const token = getToken();
  const query = token === null ? '' : `?${TOKEN_QUERY}=${encodeURIComponent(token)}`;
  return `${scheme}://${window.location.host}${WS_PATH}/${encodeURIComponent(sessionId)}${query}`;
}

/** WebSocket for one session with automatic reconnect (the server replays the screen). */
export function openTerminalSocket(sessionId: string, handlers: SocketHandlers): TerminalSocket {
  let socket: WebSocket | null = null;
  let stopped = false;
  let attempt = 0;
  let pingTimer: number | undefined;
  /** Keys typed while the link is down, sent in order once it is back. */
  let outbox: { at: number; data: string }[] = [];

  const connect = (): void => {
    const ws = new WebSocket(socketUrl(sessionId));
    socket = ws;
    ws.onopen = () => {
      attempt = 0;
      const fresh = outbox.filter((item) => Date.now() - item.at <= OUTBOX_MAX_AGE_MS);
      outbox = [];
      if (fresh.length > 0) send({ type: 'input', data: fresh.map((item) => item.data).join('') });
      handlers.onOpen();
      pingTimer = window.setInterval(() => send({ type: 'ping' }), PING_MS);
    };
    ws.onmessage = (event: MessageEvent<unknown>) => {
      if (typeof event.data !== 'string') return;
      try {
        const parsed = ServerMessageSchema.safeParse(JSON.parse(event.data));
        if (parsed.success) handlers.onMessage(parsed.data);
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = (event) => {
      window.clearInterval(pingTimer);
      handlers.onClose();
      if (stopped || event.code === NOT_FOUND_CLOSE) return;
      attempt += 1;
      window.setTimeout(connect, Math.min(500 * 2 ** attempt, 5000));
    };
  };

  const send = (message: ClientMessage): void => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    else if (message.type === 'input') outbox.push({ at: Date.now(), data: message.data });
  };

  connect();
  return {
    send,
    close: () => {
      stopped = true;
      socket?.close();
    },
  };
}
