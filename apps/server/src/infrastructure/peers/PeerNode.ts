import type { NetworkHooks } from '../../domain/networkNode.js';
import { dial } from './dial.js';
import { answerQueries, discover, type DiscoverOptions, type Found } from './discovery.js';
import { peerIdOf } from './identity.js';
import type { SigningKey } from './keys.js';
import { LinkPool } from './linkPool.js';
import type { Mux } from './mux.js';
import { askPairing, showPairing, type PairingAsk } from './pairing.js';
import { listenForPeers } from './peerListener.js';
import { acceptLink } from './secureLink.js';
import type { ServeTarget } from './tunnelServe.js';

/** This deck on the network: sharing itself, finding others, pairing and linking. Crypto lives below. */
export class PeerNode {
  readonly id: string;
  private listener: { port: number; close(): Promise<void> } | null = null;
  private answering: { close(): void } | null = null;
  private readonly pool: LinkPool;

  constructor(
    private readonly me: SigningKey,
    private readonly hooks: NetworkHooks,
    private readonly target: ServeTarget,
    private readonly net: { bindHost: string; discovery: DiscoverOptions } = {
      bindHost: '0.0.0.0',
      discovery: {},
    },
  ) {
    this.id = peerIdOf(me.publicKey);
    this.pool = new LinkPool({
      me,
      myPort: () => this.port,
      serve: () => (this.listener ? this.target : null),
      keyOf: (id) => hooks.keyOf(id),
      addressesOf: async (id) => {
        const now = (await this.discover(700)).filter((d) => d.id === id).map((d) => d.address);
        return [...new Set([...now, ...hooks.addresses(id)])];
      },
      reached: (id, address, port) => hooks.reached(id, address, null, port),
    });
  }

  get port(): number | null {
    return this.listener?.port ?? null;
  }

  async share(port: number): Promise<void> {
    if (this.listener) return;
    this.listener = await listenForPeers(this.net.bindHost, port, {
      pair: (wire, ip) => {
        const me = { key: this.me, name: this.hooks.name(), port: this.port };
        showPairing(wire, me, (asker) => this.hooks.show(asker)).then(
          (peer) => this.hooks.paired(peer, ip),
          () => wire.close(4403, 'Not paired'),
        );
      },
      link: (wire, ip) => {
        acceptLink(wire, this.me, (key) => this.hooks.known(key), this.port).then(
          (link) => {
            const id = peerIdOf(link.peerKey);
            this.hooks.reached(id, null, ip, link.peerPort);
            this.pool.adopt(id, link, false);
          },
          () => undefined,
        );
      },
    });
    const beacon = () => ({ id: this.id, name: this.hooks.name(), port: this.port ?? port });
    this.answering = await answerQueries(beacon, this.net.discovery.port).catch(() => null); // listing is optional
  }

  async unshare(): Promise<void> {
    this.answering?.close();
    this.answering = null;
    const listener = this.listener;
    this.listener = null;
    this.pool.closeAll(); // links served while sharing end with it
    await listener?.close();
  }

  async discover(waitMs?: number): Promise<Found[]> {
    const found = await discover({ ...this.net.discovery, waitMs });
    return found.filter((deck) => deck.id !== this.id);
  }

  async ask(address: string): Promise<PairingAsk> {
    const wire = await dial(address, '/pair');
    return askPairing(wire, { key: this.me, name: this.hooks.name(), port: this.port });
  }

  link(id: string): Promise<Mux> {
    return this.pool.get(id);
  }

  online(id: string): boolean {
    return this.pool.online(id);
  }

  drop(id: string): void {
    this.pool.drop(id);
  }
}
