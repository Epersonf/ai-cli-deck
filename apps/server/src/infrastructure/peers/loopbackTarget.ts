import { Readable } from 'node:stream';
import { TOKEN_HEADER } from '@deck/shared';
import { WebSocket } from 'ws';
import { forwardHeaders, responseHeaders } from './forwardHeaders.js';
import type { ServeTarget } from './tunnelServe.js';
import { wsPeerSocket } from './wsPeerSocket.js';

const SOCKET_OPEN_MS = 10_000;

const refused = (path: string) => ({
  status: 403,
  headers: { 'content-type': 'application/json' },
  body: Readable.from([
    Buffer.from(JSON.stringify({ error: `Not available to paired decks: ${path}` })),
  ]),
});

/**
 * Serves a paired deck's requests with this deck's own HTTP server on loopback, signed in with a token
 * only this process knows. `blocked` keeps some paths (pairing, password, agent endpoints) local.
 */
export function loopbackTarget(
  base: string,
  token: string,
  blocked: (path: string) => boolean,
): ServeTarget {
  const inside = (path: string): boolean => path.startsWith('/') && !path.startsWith('//');
  return {
    async http(request, signal) {
      if (!inside(request.path) || blocked(request.path)) return refused(request.path);
      const init: RequestInit & { duplex?: 'half' } = {
        method: request.method,
        headers: { ...forwardHeaders(request.headers), [TOKEN_HEADER]: token },
        redirect: 'manual',
        signal,
      };
      if (request.body) {
        init.body = Readable.toWeb(request.body) as ReadableStream<Uint8Array>;
        init.duplex = 'half';
      }
      const response = await fetch(base + request.path, init);
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => (headers[key] = value));
      const body = response.body as AsyncIterable<Uint8Array> | null;
      return { status: response.status, headers: responseHeaders(headers), body };
    },

    socket(path, headers) {
      if (!inside(path) || blocked(path)) return Promise.reject(new Error('Not available'));
      const ws = new WebSocket(base.replace(/^http/, 'ws') + path, {
        headers: { ...forwardHeaders(headers), [TOKEN_HEADER]: token },
        handshakeTimeout: SOCKET_OPEN_MS,
      });
      const socket = wsPeerSocket(ws); // listens from the start: nothing sent on open is lost
      return new Promise((resolve, reject) => {
        ws.once('open', () => resolve(socket));
        ws.once('error', reject);
        ws.once('unexpected-response', (_req, res) =>
          reject(new Error(`The deck refused the socket (${res.statusCode ?? 0})`)),
        );
      });
    },
  };
}
