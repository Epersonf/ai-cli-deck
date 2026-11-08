import { REPLAY_FRAME, ServerMessageSchema, TOKEN_QUERY, WS_PATH } from '@deck/shared';
import type { ClientMessage, ServerMessage } from '@deck/shared';
import { socketUrl as deckSocket } from '../api/base';
import { getToken } from '../api/token';
import { createOutbox } from './inputOutbox';

export interface SocketHandlers {
  onOpen(): void;
  onMessage(message: ServerMessage): void;
  /** Terminal bytes, straight from a binary frame; `replay` is the screen sent once on connect. */
  onOutput(bytes: Uint8Array, replay: boolean): void;
  onClose(): void;
}

export interface TerminalSocket {
  send(message: ClientMessage): void;
  close(): void;
}

const NOT_FOUND_CLOSE = 4404;
/** Silence this long makes the client ask; a link that stays silent for `DEAD_MS` is dropped and rebuilt. */
const QUIET_MS = 3500;
const DEAD_MS = 12_000;
const WATCH_MS = 2000;
/** Unconfirmed input older than this is not sent again after a reconnect (it would surprise the user). */
const OUTBOX_MAX_AGE_MS = 30_000;

function sessionSocketUrl(sessionId: string): string {
  const token = getToken();
  const query = token === null ? '' : `?${TOKEN_QUERY}=${encodeURIComponent(token)}`;
  return deckSocket(`${WS_PATH}/${encodeURIComponent(sessionId)}${query}`);
}

/** WebSocket for one session with automatic reconnect (the server replays the screen). */
export function openTerminalSocket(sessionId: string, handlers: SocketHandlers): TerminalSocket {
  let socket: WebSocket | null = null;
  let stopped = false;
  let attempt = 0;
  let lastHeard = Date.now();
  let retry: number | undefined;
  let watchdog: number | undefined;
  const cid = Math.random().toString(36).slice(2, 12);
  const outbox = createOutbox(OUTBOX_MAX_AGE_MS);

  const raw = (message: ClientMessage): void => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };
  const send = (message: ClientMessage): void => {
    if (message.type !== 'input') return raw(message);
    raw({ ...message, cid, seq: outbox.add(message.data) });
  };

  const connect = (): void => {
    window.clearTimeout(retry);
    const ws = new WebSocket(sessionSocketUrl(sessionId));
    ws.binaryType = 'arraybuffer';
    socket = ws;
    ws.onopen = () => {
      attempt = 0;
      lastHeard = Date.now();
      // Whatever the server never confirmed goes again; it applies each number once.
      for (const item of outbox.pending()) {
        raw({ type: 'input', data: item.data, cid, seq: item.seq });
      }
      handlers.onOpen();
      window.clearInterval(watchdog);
      watchdog = window.setInterval(watch, WATCH_MS);
    };
    ws.onmessage = (event: MessageEvent<unknown>) => {
      lastHeard = Date.now();
      if (event.data instanceof ArrayBuffer) {
        const frame = new Uint8Array(event.data);
        if (frame.length > 1) handlers.onOutput(frame.subarray(1), frame[0] === REPLAY_FRAME);
        return;
      }
      if (typeof event.data !== 'string') return;
      try {
        const parsed = ServerMessageSchema.safeParse(JSON.parse(event.data));
        if (!parsed.success) return;
        if (parsed.data.type === 'ack') outbox.ack(parsed.data.seq);
        handlers.onMessage(parsed.data);
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = (event) => {
      if (socket !== ws) return; // an older link that was replaced
      window.clearInterval(watchdog);
      handlers.onClose();
      if (stopped || event.code === NOT_FOUND_CLOSE) return;
      attempt += 1;
      retry = window.setTimeout(connect, Math.min(500 * 2 ** attempt, 5000));
    };
  };

  /** A phone's link often dies without a close event: ask when it is quiet, rebuild it when it stays so. */
  const watch = (): void => {
    const quiet = Date.now() - lastHeard;
    if (quiet > DEAD_MS) socket?.close();
    else if (quiet > QUIET_MS) raw({ type: 'ping' });
  };

  /** Back on the network or on screen: do not wait out the backoff, and check the link we have. */
  const wake = (): void => {
    if (stopped || document.visibilityState === 'hidden') return;
    if (!socket || socket.readyState === WebSocket.CLOSED) {
      attempt = 0;
      connect();
    } else if (socket.readyState === WebSocket.OPEN) {
      lastHeard = Math.min(lastHeard, Date.now() - DEAD_MS + 3000); // must answer within ~3 s
      raw({ type: 'ping' });
    }
  };
  window.addEventListener('online', wake);
  document.addEventListener('visibilitychange', wake);

  connect();
  return {
    send,
    close: () => {
      stopped = true;
      window.clearInterval(watchdog);
      window.clearTimeout(retry);
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', wake);
      socket?.close();
    },
  };
}
