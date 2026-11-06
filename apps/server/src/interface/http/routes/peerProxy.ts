import type { Readable } from 'node:stream';
import { PEER_PATH, TOKEN_QUERY } from '@deck/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import { forwardHeaders, responseHeaders } from '../../../infrastructure/peers/forwardHeaders.js';
import type { Mux } from '../../../infrastructure/peers/mux.js';
import { tunnelRequest, tunnelSocket } from '../../../infrastructure/peers/tunnelClient.js';
import { wsPeerSocket } from '../../../infrastructure/peers/wsPeerSocket.js';
import type { Container } from '../../container.js';

const CLOSE_UNREACHABLE = 4502;

/** The path on the other deck: what follows `/peer/<id>`, with this deck's own token removed. */
function innerPath(request: FastifyRequest): { peer: string; path: string } {
  const params = request.params as { peer: string; '*'?: string };
  const [, query = ''] = request.url.split('?', 2);
  const search = new URLSearchParams(query);
  search.delete(TOKEN_QUERY);
  const rest = search.toString();
  return { peer: params.peer, path: `/${params['*'] ?? ''}${rest ? `?${rest}` : ''}` };
}

const message = (error: unknown): string =>
  error instanceof Error ? error.message : 'Cannot reach that deck';

const escape = (text: string): string => text.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** What opening an unreachable deck shows instead of its app: why, and the way back. */
const unreachablePage = (reason: string): string =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">` +
  `<title>Deck</title><body style="font:16px system-ui;background:#17100a;color:#ecdcb8;padding:24px">` +
  `<h1 style="font-size:20px">That deck cannot be reached</h1><p>${escape(reason)}</p>` +
  `<p>Is it on, sharing, and on this network (or VPN)?</p><p><a style="color:#f0cf85" href="/">Back</a></p>`;

/**
 * A paired deck's whole app under `/peer/<id>/`: every request and WebSocket goes through the encrypted
 * link, so whatever the deck can do works on the other one with no code per feature.
 */
export async function peerProxyRoutes(app: FastifyInstance, c: Container): Promise<void> {
  const tunnel = (peer: string): Promise<Mux> => c.network.tunnel(peer) as Promise<Mux>;
  await app.register(async (scope) => {
    // Bodies stay streams: uploads cross over as they arrive, never held in memory.
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser('*', (_request, payload, done) => done(null, payload));

    scope.get(`${PEER_PATH}/:peer`, (request, reply) =>
      reply.redirect(
        `${PEER_PATH}/${encodeURIComponent((request.params as { peer: string }).peer)}/`,
      ),
    );

    const http = async (request: FastifyRequest, reply: FastifyReply) => {
      const { peer, path } = innerPath(request);
      try {
        const response = await tunnelRequest(await tunnel(peer), {
          method: request.method,
          path,
          headers: forwardHeaders(request.headers),
          body: (request.body as Readable | undefined) ?? null,
        });
        // The browser went away (or the answer is done): stop streaming from the other deck.
        reply.raw.on('close', () => response.body.destroy());
        return reply
          .code(response.status)
          .headers(responseHeaders(response.headers))
          .send(response.body);
      } catch (error) {
        const page = request.method === 'GET' && !/^\/(api|ws)(\/|$)/.test(path);
        if (page)
          return reply
            .code(502)
            .type('text/html')
            .send(unreachablePage(message(error)));
        return reply.code(502).send({ error: message(error) });
      }
    };
    const url = `${PEER_PATH}/:peer/*`;
    scope.route({
      method: 'GET',
      url,
      handler: http,
      wsHandler: (socket: WebSocket, request) => {
        const { peer, path } = innerPath(request);
        const local = wsPeerSocket(socket); // keeps what the browser sends while the far socket opens
        tunnel(peer)
          .then((mux) => tunnelSocket(mux, path, forwardHeaders(request.headers), local))
          .catch((error: unknown) => socket.close(CLOSE_UNREACHABLE, message(error).slice(0, 120)));
      },
    });
    scope.route({ method: ['POST', 'PUT', 'PATCH', 'DELETE'], url, handler: http }); // HEAD comes with GET
  });
}
