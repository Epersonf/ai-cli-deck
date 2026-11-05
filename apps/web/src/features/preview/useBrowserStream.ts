import {
  BROWSER_SIZE,
  BROWSER_WS_PATH,
  BrowserServerMessageSchema,
  TOKEN_QUERY,
  type BrowserClientMessage,
  type BrowserServerMessage,
} from '@deck/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from '../../shared/api/token';

export type PageState = Extract<BrowserServerMessage, { type: 'page' }>;

const RETRY_MS = 1000;
/** An old frame stays alive this long, so the picture never blinks while the next one decodes. */
const REVOKE_MS = 1000;

function streamUrl(sessionId: string): string {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const token = getToken();
  const query = token === null ? '' : `?${TOKEN_QUERY}=${encodeURIComponent(token)}`;
  return `${scheme}://${window.location.host}${BROWSER_WS_PATH}/${encodeURIComponent(sessionId)}${query}`;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.round(Math.min(max, Math.max(min, value)));

/**
 * The live picture of the session's Chromium while the pane is shown: frames arrive only when the page
 * changes, and input goes back on the same socket. Reconnects by itself.
 */
export function useBrowserStream(sessionId: string, visible: boolean) {
  const [frame, setFrame] = useState<string | null>(null);
  const [page, setPage] = useState<PageState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const size = useRef<{ width: number; height: number } | null>(null);
  /** An address asked for before the socket was up: opened as soon as it is. */
  const queued = useRef<BrowserClientMessage | null>(null);

  const send = useCallback((message: BrowserClientMessage): void => {
    const ws = socket.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
    else if (message.kind === 'navigate') queued.current = message;
  }, []);

  /** Fits the page to the space it is shown in (also sent again after a reconnect). */
  const resize = useCallback(
    (width: number, height: number): void => {
      const next = {
        width: clamp(width, BROWSER_SIZE.minWidth, BROWSER_SIZE.maxWidth),
        height: clamp(height, BROWSER_SIZE.minHeight, BROWSER_SIZE.maxHeight),
      };
      if (next.width === size.current?.width && next.height === size.current.height) return;
      size.current = next;
      send({ kind: 'resize', ...next });
    },
    [send],
  );

  useEffect(() => {
    if (!visible) return;
    let closed = false;
    let retry = 0;
    let ws: WebSocket;
    const show = (blob: Blob): void => {
      const next = URL.createObjectURL(blob);
      setFrame((previous) => {
        if (previous) window.setTimeout(() => URL.revokeObjectURL(previous), REVOKE_MS);
        return next;
      });
    };
    const connect = (): void => {
      ws = new WebSocket(streamUrl(sessionId));
      socket.current = ws;
      ws.onopen = () => {
        if (size.current) send({ kind: 'resize', ...size.current });
        if (queued.current) send(queued.current);
        queued.current = null;
      };
      ws.onmessage = (event: MessageEvent<string | Blob>) => {
        if (typeof event.data !== 'string') return show(event.data);
        const message = BrowserServerMessageSchema.safeParse(JSON.parse(event.data));
        if (!message.success) return;
        if (message.data.type === 'error') return setError(message.data.message);
        setPage(message.data);
        setError(null);
      };
      ws.onclose = () => {
        socket.current = null;
        if (!closed) retry = window.setTimeout(connect, RETRY_MS);
      };
    };
    connect();
    return () => {
      closed = true;
      window.clearTimeout(retry);
      ws.close();
    };
  }, [sessionId, visible, send]);

  return { frame, page, error, send, resize };
}
