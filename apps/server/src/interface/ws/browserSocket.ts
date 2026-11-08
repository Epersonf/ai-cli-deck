import {
  BROWSER_WS_PATH,
  sessionOfPreviewKey,
  parseBrowserClientMessage,
  type BrowserServerMessage,
} from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { PageInfo } from '../../application/browserTypes.js';
import type { Container } from '../container.js';

const CLOSE_NOT_FOUND = 4404;
/** Past this much unsent data a frame is skipped: the next one shows the page as it is by then. */
const MAX_BUFFERED_BYTES = 512 * 1024;
/** How often the address and title are re-read while frames flow (links change them without input). */
const INFO_MS = 1000;

/**
 * The live view of a session's Chromium: JPEG frames as the page changes, and the device's taps, scrolls,
 * keys and size coming back on the same socket (no request per event).
 */
export function browserSocket(app: FastifyInstance, c: Container): void {
  app.get(`${BROWSER_WS_PATH}/:id`, { websocket: true }, (socket: WebSocket, request) => {
    const { id } = request.params as { id: string };
    // `id` is a preview key: the session id, plus "~n" for a session's further tabs (a page of its own each).
    const sessionId = sessionOfPreviewKey(id);
    if (sessionId === null || !c.sessions.get(sessionId)) {
      return socket.close(CLOSE_NOT_FOUND, 'session not found');
    }

    const open = (): boolean => socket.readyState === socket.OPEN;
    const json = (message: BrowserServerMessage): void => {
      if (open()) socket.send(JSON.stringify(message));
    };
    const report = (job: Promise<PageInfo>): void =>
      void job
        .then((info) => json({ type: 'page', ...info }))
        .catch((e: unknown) => json({ type: 'error', message: messageOf(e) }));

    let infoAt = 0;
    const frame = (jpeg: Buffer): void => {
      if (!open() || socket.bufferedAmount > MAX_BUFFERED_BYTES) return;
      socket.send(jpeg);
      if (Date.now() - infoAt < INFO_MS) return;
      infoAt = Date.now();
      report(c.browser.state(id));
    };

    let closed = false;
    let stop: (() => Promise<void>) | null = null;
    c.browser
      .watch(id, frame)
      .then((stopper) => (closed ? void stopper() : (stop = stopper)))
      .catch((e: unknown) => json({ type: 'error', message: messageOf(e) }));
    // A still page sends no frames: someone watching it still keeps the browser from closing as idle.
    const keepAlive = setInterval(() => void c.browser.state(id).catch(() => undefined), 60_000);
    socket.on('close', () => {
      closed = true;
      clearInterval(keepAlive);
      void stop?.();
    });

    socket.on('message', (raw) => {
      const message = parseBrowserClientMessage(raw.toString());
      if (!message) return;
      if (message.kind === 'navigate') report(c.browser.navigate(id, message.url));
      else if (message.kind === 'resize')
        report(c.browser.resize(id, message.width, message.height));
      else report(c.browser.input(id, message));
    });
  });
}

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : 'Browser error');
