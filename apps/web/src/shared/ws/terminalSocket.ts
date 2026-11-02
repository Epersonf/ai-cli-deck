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

  const connect = (): void => {
    const ws = new WebSocket(socketUrl(sessionId));
    socket = ws;
    ws.onopen = () => {
      attempt = 0;
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
