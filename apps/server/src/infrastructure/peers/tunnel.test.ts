import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { TOKEN_HEADER } from '@deck/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';
import { signingKey } from './keys.js';
import { loopbackTarget } from './loopbackTarget.js';
import { Mux } from './mux.js';
import type { PeerSocket } from './peerSocket.js';
import { acceptLink, initiateLink } from './secureLink.js';
import { tunnelRequest, tunnelSocket } from './tunnelClient.js';
import { serveWith } from './tunnelServe.js';
import { memoryWires } from './wire.js';

let server: Server;
let base = '';

/** The far deck's own server: echoes what it got, and checks the tunnel signed in for it. */
beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          method: req.method,
          url: req.url,
          token: req.headers[TOKEN_HEADER],
          origin: req.headers.origin ?? null,
          body: Buffer.concat(chunks).toString(),
        }),
      );
    });
  });
  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws) => {
    ws.send('welcome'); // sent at once on open: must not be lost
    ws.on('message', (data) => ws.send(`echo ${String(data)}`));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

async function tunnel(): Promise<Mux> {
  const phone = signingKey();
  const pc = signingKey();
  const [a, b] = memoryWires();
  const [left, right] = await Promise.all([
    initiateLink(a, phone, pc.publicKey, null),
    acceptLink(b, pc, () => true, null),
  ]);
  const target = loopbackTarget(base, 'inner-token', (path) => path.startsWith('/api/network'));
  new Mux(right, false, serveWith(target));
  return new Mux(left, true, null);
}

const json = async (body: Readable): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = [];
  for await (const chunk of body) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>;
};

describe('tunnel to a paired deck', () => {
  it('carries a request and its streamed body, signed in as the far deck itself', async () => {
    const mux = await tunnel();
    const res = await tunnelRequest(mux, {
      method: 'POST',
      path: '/api/sessions?x=1',
      headers: {
        'content-type': 'text/plain',
        origin: 'http://localhost:7842',
        [TOKEN_HEADER]: 'mine',
      },
      body: Readable.from([Buffer.from('hello '), Buffer.from('there')]),
    });
    expect(res.status).toBe(200);
    expect(await json(res.body)).toEqual({
      method: 'POST',
      url: '/api/sessions?x=1',
      token: 'inner-token',
      origin: null,
      body: 'hello there',
    });
  });

  it('keeps pairing and other local-only paths away from the other deck', async () => {
    const mux = await tunnel();
    const res = await tunnelRequest(mux, {
      method: 'GET',
      path: '/api/network/peers',
      headers: {},
      body: null,
    });
    expect(res.status).toBe(403);
  });

  it('joins a WebSocket, keeping what the far side sends on open', async () => {
    const mux = await tunnel();
    const got: string[] = [];
    let listener: (data: Buffer, binary: boolean) => void = () => undefined;
    const local: PeerSocket = {
      send: (data) => got.push(data.toString()),
      close: () => undefined,
      onMessage: (next) => (listener = next),
      onClose: () => undefined,
    };
    await tunnelSocket(mux, '/ws/x', {}, local);
    listener(Buffer.from('hi'), false);
    await new Promise((r) => setTimeout(r, 100));
    expect(got).toEqual(['welcome', 'echo hi']);
  });
});
