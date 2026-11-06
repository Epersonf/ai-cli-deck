import { Readable } from 'node:stream';
import type { Mux } from './mux.js';
import { bridge, type PeerSocket } from './peerSocket.js';

export type Headers = Record<string, string>;

export interface TunnelRequest {
  method: string;
  /** Path and query on the other deck (`/api/sessions?x=1`). */
  path: string;
  headers: Headers;
  body: Readable | null;
}

export interface TunnelResponse {
  status: number;
  headers: Headers;
  body: Readable;
}

const headersOf = (value: unknown): Headers =>
  typeof value === 'object' && value !== null ? (value as Headers) : {};

/** Sends an HTTP request through the tunnel; the response body streams as it arrives. */
export function tunnelRequest(mux: Mux, request: TunnelRequest): Promise<TunnelResponse> {
  return new Promise((resolve, reject) => {
    let done = false;
    const body = new Readable({
      read: () => undefined,
      destroy(error, callback) {
        if (!done) mux.send({ k: 'x', s: id }); // the reader gave up: stop the other side
        finish();
        callback(error);
      },
    });
    const finish = (): void => {
      done = true;
      mux.end(id);
    };
    const fail = (reason: string): void => {
      finish();
      reject(new Error(reason));
      body.destroy(new Error(reason));
    };
    const id = mux.open({
      frame(head, chunk) {
        if (head.k === 'res')
          resolve({ status: Number(head.st), headers: headersOf(head.h), body });
        else if (head.k === 'd') body.push(chunk);
        else if (head.k === 'e') {
          finish();
          body.push(null);
        } else if (head.k === 'x') fail(String(head.msg ?? 'The other deck dropped the request'));
      },
      drop: fail,
    });
    mux.send({ k: 'req', s: id, m: request.method, p: request.path, h: request.headers });
    void (async () => {
      try {
        for await (const chunk of request.body ?? []) {
          if (done) return;
          await mux.drain();
          mux.send({ k: 'd', s: id }, chunk as Buffer);
        }
        if (!done) mux.send({ k: 'e', s: id });
      } catch {
        if (!done) mux.send({ k: 'x', s: id });
        fail('The request body broke off');
      }
    })();
  });
}

/** Opens a WebSocket on the other deck through the tunnel and joins it to `local`. */
export function tunnelSocket(
  mux: Mux,
  path: string,
  headers: Headers,
  local: PeerSocket,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = mux.open({
      frame(head) {
        if (head.k === 'wsok') {
          bridge(mux, id, local); // replaces this handler
          resolve();
        } else if (head.k === 'x') {
          mux.end(id);
          reject(new Error(String(head.msg ?? 'The other deck refused the socket')));
        }
      },
      drop: (reason) => reject(new Error(reason)),
    });
    mux.send({ k: 'wso', s: id, p: path, h: headers });
  });
}
