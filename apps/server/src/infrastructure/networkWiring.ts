import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { hostname, networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { AGENT_PATH, MCP_PATH, PAIR_CODE_LENGTH, PEER_PATH } from '@deck/shared';
import { NetworkService } from '../application/NetworkService.js';
import { PairingFlow } from '../application/PairingFlow.js';
import { PairingRequests } from '../application/PairingRequests.js';
import { PeerBook } from '../application/PeerBook.js';
import { loadIdentity, peerIdOf } from './peers/identity.js';
import { loopbackTarget } from './peers/loopbackTarget.js';
import type { Mux } from './peers/mux.js';
import { PeerNode } from './peers/PeerNode.js';
import { JsonNetworkStore } from './store/JsonNetworkStore.js';
import { isLoopbackHost } from './config/bind.js';
import { safeEqual } from '../domain/safeEqual.js';

/** Paths a paired deck may not use here: this deck's pairing, login and password, and agent endpoints. */
const KEPT_LOCAL = ['/api/network', '/api/login', '/api/password', MCP_PATH, AGENT_PATH, PEER_PATH];
export const keptLocal = (path: string): boolean =>
  KEPT_LOCAL.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`),
  );

const ipv4 = (): string[] =>
  Object.values(networkInterfaces())
    .flatMap((list) => list ?? [])
    .filter((nic) => nic.family === 'IPv4' && !nic.internal)
    .map((nic) => nic.address);

/** A machine name worth showing ("localhost" says nothing on a phone). */
const machineName = (): string => {
  const name = hostname().split('.')[0] ?? '';
  return name && name !== 'localhost' ? name : 'Deck';
};

export interface NetworkWiringOptions {
  configDir: string;
  /** This deck's own HTTP server, which serves the requests paired decks send through a link. */
  host: string;
  port: number;
  peerPort: number;
  name: string | undefined;
}

/** Where this deck's own server answers on this machine. */
function selfUrl(host: string, port: number): string {
  const local = isLoopbackHost(host) || host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
  return `http://${local.includes(':') ? `[${local}]` : local}:${port}`;
}

export async function networkServices(options: NetworkWiringOptions) {
  const me = await loadIdentity(join(options.configDir, 'identity.pem'));
  const book = await PeerBook.open(
    new JsonNetworkStore(join(options.configDir, 'network.json')),
    () => new Date(),
  );
  const pairingRequests = new PairingRequests(
    () => Date.now(),
    () => String(randomInt(0, 10 ** PAIR_CODE_LENGTH)).padStart(PAIR_CODE_LENGTH, '0'),
    () => randomUUID(),
  );
  const network = new NetworkService<Mux>({
    book,
    requests: pairingRequests,
    defaultName: options.name ?? machineName(),
    peerPort: options.peerPort,
    addresses: ipv4,
    idOf: peerIdOf,
  });
  // Requests a paired deck sends through a link reach this server on loopback, signed in with this.
  const peerToken = randomBytes(32).toString('base64url');
  const target = loopbackTarget(selfUrl(options.host, options.port), peerToken, keptLocal);
  await network.attach(new PeerNode(me, network.hooks, target));
  const pairing = new PairingFlow(network as NetworkService<unknown>, book, peerIdOf, () =>
    randomUUID(),
  );
  return {
    network: network as NetworkService<unknown>,
    pairing,
    pairingRequests,
    isPeerToken: (token: string | undefined) => token !== undefined && safeEqual(token, peerToken),
  };
}
