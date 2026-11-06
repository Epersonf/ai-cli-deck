import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { TOKEN_HEADER } from '@deck/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NetworkService } from '../../application/NetworkService.js';
import { PairingFlow } from '../../application/PairingFlow.js';
import { PairingRequests } from '../../application/PairingRequests.js';
import { PeerBook } from '../../application/PeerBook.js';
import type { NetworkState } from '../../domain/network.js';
import { peerIdOf } from './identity.js';
import { signingKey } from './keys.js';
import { loopbackTarget } from './loopbackTarget.js';
import type { Mux } from './mux.js';
import { PeerNode } from './PeerNode.js';
import { tunnelRequest } from './tunnelClient.js';

const DISCOVERY = 47_000 + Math.floor(Math.random() * 2000);
let server: Server;
let selfUrl = '';
let ids = 0;

/** The deck's own server: tells who signed in. */
beforeAll(async () => {
  server = createServer((req, res) => res.end(String(req.headers[TOKEN_HEADER])));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  selfUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

async function deck(name: string) {
  let state: NetworkState = { sharing: false, name, peers: [] };
  const store = {
    load: async () => state,
    save: async (next: NetworkState) => void (state = next),
  };
  const book = await PeerBook.open(store, () => new Date());
  const requests = new PairingRequests(
    Date.now,
    () => '123456',
    () => `r${ids++}`,
  );
  const network = new NetworkService<Mux>({
    book,
    requests,
    defaultName: name,
    peerPort: 0,
    addresses: () => [],
    idOf: peerIdOf,
  });
  const target = loopbackTarget(selfUrl, `token-of-${name}`, () => false);
  const discovery = { port: DISCOVERY, targets: ['127.0.0.1'] };
  await network.attach(
    new PeerNode(signingKey(), network.hooks, target, { bindHost: '127.0.0.1', discovery }),
  );
  const flow = new PairingFlow(
    network as NetworkService<unknown>,
    book,
    peerIdOf,
    () => `p${ids++}`,
  );
  return { network, flow, requests };
}

const text = async (mux: Mux, path: string): Promise<string> => {
  const res = await tunnelRequest(mux, { method: 'GET', path, headers: {}, body: null });
  const chunks: Buffer[] = [];
  for await (const chunk of res.body) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString();
};

describe('two decks', () => {
  it('find each other, pair with the code, and one uses the other through the link', async () => {
    const phone = await deck('Phone');
    const pc = await deck('PC');
    await pc.network.update({ sharing: true });
    const port = pc.network.status().port;
    expect(port).toBeGreaterThan(0);

    const nearby = await phone.network.nearby();
    expect(nearby).toContainEqual(
      expect.objectContaining({ name: 'PC', address: `127.0.0.1:${port}`, paired: false }),
    );

    const started = await phone.flow.start(`127.0.0.1:${port}`);
    expect(started.name).toBe('PC');
    expect(pc.requests.list()).toEqual([
      expect.objectContaining({ name: 'Phone', code: '123456' }),
    ]);
    expect(await phone.flow.submit(started.pairingId, '000000')).toEqual({ peer: null, left: 2 });
    const result = await phone.flow.submit(started.pairingId, '123456');
    expect(result.peer?.name).toBe('PC');
    await new Promise((r) => setTimeout(r, 50));
    expect(pc.network.peers().map((p) => p.name)).toEqual(['Phone']);

    const pcId = pc.network.status().id;
    const mux = await phone.network.tunnel(pcId);
    expect(await text(mux, '/api/x')).toBe('token-of-PC');
    expect(phone.network.peers()[0]?.online).toBe(true);

    // The PC forgets the phone: the link ends and cannot be opened again.
    await pc.network.forget(phone.network.status().id);
    await new Promise((r) => setTimeout(r, 50));
    await expect(phone.network.tunnel(pcId)).rejects.toThrow();
    await pc.network.update({ sharing: false });
  });

  it('refuses to link to a deck that only claims to be the paired one', async () => {
    const phone = await deck('Phone');
    await expect(phone.network.tunnel('nobody')).rejects.toThrow('Paired deck not found');
  });
});
