import { createServer, type Server } from 'node:http';
import { WebSocketServer } from 'ws';
import { wsWire, type Wire } from './wire.js';

/** Messages above this are refused: frames are small chunks, never whole files. */
const MAX_FRAME = 16 << 20;

export interface ListenerHandlers {
  /** A deck asks to pair (`/pair`). */
  pair(wire: Wire, ip: string): void;
  /** A paired deck opens a link (`/link`). */
  link(wire: Wire, ip: string): void;
}

/**
 * The port a sharing deck listens on for other decks: only WebSockets for pairing and links, never the
 * app or its API (those stay on loopback, behind the deck's own login).
 */
export async function listenForPeers(
  host: string,
  port: number,
  handlers: ListenerHandlers,
): Promise<{ port: number; close(): Promise<void> }> {
  const sockets = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME });
  const server: Server = createServer((_req, res) => {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end('{"deck":"clideck"}');
  });
  server.on('upgrade', (req, socket, head) => {
    const path = (req.url ?? '').split('?')[0];
    const route = path === '/pair' ? handlers.pair : path === '/link' ? handlers.link : null;
    if (!route) return socket.destroy();
    const ip = (req.socket.remoteAddress ?? '').replace(/^::ffff:/, '');
    sockets.handleUpgrade(req, socket, head, (ws) => route(wsWire(ws), ip));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => (server.off('error', reject), resolve()));
  });
  const address = server.address();
  return {
    port: typeof address === 'object' && address ? address.port : port,
    close: () =>
      new Promise((resolve) => {
        for (const client of sockets.clients) client.terminate();
        server.close(() => resolve());
      }),
  };
}
