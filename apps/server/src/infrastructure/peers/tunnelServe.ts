import { Readable } from 'node:stream';
import type { Head } from './frameCipher.js';
import type { Mux } from './mux.js';
import { bridge, type PeerSocket } from './peerSocket.js';
import type { Headers, TunnelRequest } from './tunnelClient.js';

export interface ServedResponse {
  status: number;
  headers: Headers;
  body: AsyncIterable<Uint8Array> | null;
}

/** What a deck does with requests and sockets that arrive through a tunnel. */
export interface ServeTarget {
  http(request: TunnelRequest, signal: AbortSignal): Promise<ServedResponse>;
  socket(path: string, headers: Headers): Promise<PeerSocket>;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const headersOf = (value: unknown): Headers =>
  typeof value === 'object' && value !== null ? (value as Headers) : {};

function serveHttp(mux: Mux, target: ServeTarget, head: Head): void {
  const id = Number(head.s);
  const abort = new AbortController();
  let open = true;
  const finish = (): void => {
    open = false;
    mux.end(id);
  };
  const method = text(head.m).toUpperCase();
  const body =
    method === 'GET' || method === 'HEAD' ? null : new Readable({ read: () => undefined });
  const stop = (): void => {
    finish();
    abort.abort();
    body?.destroy();
  };
  mux.adopt(id, {
    frame(next, chunk) {
      if (next.k === 'd') body?.push(chunk);
      if (next.k === 'e') body?.push(null);
      if (next.k === 'x') stop();
    },
    drop: stop,
  });
  void (async () => {
    try {
      const request = { method, path: text(head.p), headers: headersOf(head.h), body };
      const response = await target.http(request, abort.signal);
      mux.send({ k: 'res', s: id, st: response.status, h: response.headers });
      for await (const chunk of response.body ?? []) {
        if (!open) return;
        await mux.drain();
        mux.send({ k: 'd', s: id }, chunk);
      }
      if (open) mux.send({ k: 'e', s: id });
    } catch (error) {
      if (open) mux.send({ k: 'x', s: id, msg: error instanceof Error ? error.message : 'failed' });
    }
    finish();
  })();
}

function serveSocket(mux: Mux, target: ServeTarget, head: Head): void {
  const id = Number(head.s);
  target.socket(text(head.p), headersOf(head.h)).then(
    (socket) => {
      mux.send({ k: 'wsok', s: id }); // before any message the socket forwards
      bridge(mux, id, socket);
    },
    (error: unknown) =>
      mux.send({ k: 'x', s: id, msg: error instanceof Error ? error.message : 'failed' }),
  );
}

/** The `serve` hook of a Mux: answers the other deck's requests with `target`. */
export const serveWith =
  (target: ServeTarget) =>
  (mux: Mux, head: Head): void =>
    head.k === 'req' ? serveHttp(mux, target, head) : serveSocket(mux, target, head);
