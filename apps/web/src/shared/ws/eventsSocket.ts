import { EVENTS_WS_PATH, PushMessageSchema, TOKEN_QUERY } from '@deck/shared';
import type { PushMessage } from '@deck/shared';
import { socketUrl } from '../api/base';
import { getToken } from '../api/token';

export interface EventsHandlers {
  onMessage(message: PushMessage): void;
  /** True once connected (the caller should then fetch the current state once), false when the link drops. */
  onLive(live: boolean): void;
  /** The deck's memory changed (a scope, and the profile for the profile scope). */
  onMemory?(scope: string, profileId: string | null): void;
}

/** `{type:'memory', scope, profileId}`: refetch that memory. */
function memoryPush(raw: unknown): { scope: string; profileId: string | null } | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as { type?: unknown; scope?: unknown; profileId?: unknown };
  if (m.type !== 'memory' || typeof m.scope !== 'string') return null;
  return { scope: m.scope, profileId: typeof m.profileId === 'string' ? m.profileId : null };
}

/** Quiet on purpose: one tiny ping now and then, because every wake-up costs the phone battery. */
const PING_MS = 25_000;
const DEAD_MS = 60_000;

function url(): string {
  const token = getToken();
  return socketUrl(
    `${EVENTS_WS_PATH}${token === null ? '' : `?${TOKEN_QUERY}=${encodeURIComponent(token)}`}`,
  );
}

/** The deck's change feed with reconnect; returns the function that closes it. */
export function openEventsSocket(handlers: EventsHandlers): () => void {
  let socket: WebSocket | null = null;
  let stopped = false;
  let attempt = 0;
  let heardAt = Date.now();
  let retry: number | undefined;
  let beat: number | undefined;

  const connect = (): void => {
    window.clearTimeout(retry);
    const ws = new WebSocket(url());
    socket = ws;
    ws.onopen = () => {
      attempt = 0;
      heardAt = Date.now();
      handlers.onLive(true);
      window.clearInterval(beat);
      beat = window.setInterval(() => {
        if (Date.now() - heardAt > DEAD_MS) ws.close();
        else if (ws.readyState === WebSocket.OPEN) ws.send('ping');
      }, PING_MS);
    };
    ws.onmessage = (event: MessageEvent<unknown>) => {
      heardAt = Date.now();
      if (typeof event.data !== 'string') return;
      try {
        const raw: unknown = JSON.parse(event.data);
        const memory = memoryPush(raw);
        if (memory) return handlers.onMemory?.(memory.scope, memory.profileId);
        const parsed = PushMessageSchema.safeParse(raw);
        if (parsed.success) handlers.onMessage(parsed.data);
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = () => {
      if (socket !== ws) return;
      window.clearInterval(beat);
      handlers.onLive(false);
      if (stopped) return;
      attempt += 1;
      retry = window.setTimeout(connect, Math.min(1000 * 2 ** attempt, 15_000));
    };
  };

  const wake = (): void => {
    if (stopped || document.visibilityState === 'hidden') return;
    if (!socket || socket.readyState === WebSocket.CLOSED) {
      attempt = 0;
      connect();
    }
  };
  window.addEventListener('online', wake);
  document.addEventListener('visibilitychange', wake);

  connect();
  return () => {
    stopped = true;
    window.clearInterval(beat);
    window.clearTimeout(retry);
    window.removeEventListener('online', wake);
    document.removeEventListener('visibilitychange', wake);
    socket?.close();
  };
}
