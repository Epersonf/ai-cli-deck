import { parsePeerAddress } from '@deck/shared';
import type { NearbyDeck, NetworkStatus, PeerInfo } from '@deck/shared';
import { invalid, notFound } from '../domain/errors.js';
import type { NetworkHooks, NetworkNode } from '../domain/networkNode.js';
import type { PairingRequests } from './PairingRequests.js';
import type { PeerBook } from './PeerBook.js';

export interface NetworkServiceDeps {
  book: PeerBook;
  requests: PairingRequests;
  /** Name when the user set none (the machine's). */
  defaultName: string;
  /** Port to listen on while sharing. */
  peerPort: number;
  /** This machine's IPv4 addresses. */
  addresses(): string[];
  idOf(key: Buffer): string;
}

/** Sharing this deck, its paired decks, and what the transport needs to know about them. */
export class NetworkService<Tunnel> {
  private error: string | null = null;
  private node: NetworkNode<Tunnel> | null = null;
  readonly hooks: NetworkHooks;

  constructor(private readonly deps: NetworkServiceDeps) {
    const { book } = deps;
    this.hooks = {
      name: () => this.name,
      known: (key) => book.byKey(key.toString('base64')) !== undefined,
      show: (asker) => deps.requests.show(asker),
      paired: (peer, ip) =>
        void book.pair({
          id: deps.idOf(peer.key),
          name: peer.name,
          key: peer.key.toString('base64'),
          addresses: peer.port ? [`${ip}:${peer.port}`] : [],
        }),
      keyOf: (id) => {
        const peer = book.get(id);
        return peer ? Buffer.from(peer.key, 'base64') : null;
      },
      addresses: (id) => book.get(id)?.addresses ?? [],
      reached: (id, address, ip, port) =>
        void book.reached(id, address ?? (ip && port ? `${ip}:${port}` : null)),
    };
  }

  /** Attaches the transport and starts sharing if it was on. */
  async attach(node: NetworkNode<Tunnel>): Promise<void> {
    this.node = node;
    if (this.deps.book.sharing) await this.startSharing();
  }

  get name(): string {
    return this.deps.book.name ?? this.deps.defaultName;
  }

  status(): NetworkStatus {
    const node = this.must();
    return {
      id: node.id,
      name: this.name,
      sharing: this.deps.book.sharing,
      port: node.port,
      addresses: this.deps.addresses(),
      error: this.error,
    };
  }

  async update(body: {
    sharing?: boolean | undefined;
    name?: string | undefined;
  }): Promise<NetworkStatus> {
    if (body.name !== undefined) await this.deps.book.settings({ name: body.name });
    if (body.sharing !== undefined && body.sharing !== this.deps.book.sharing) {
      await this.deps.book.settings({ sharing: body.sharing });
      if (body.sharing) await this.startSharing();
      else await this.must().unshare();
    }
    return this.status();
  }

  peers(): PeerInfo[] {
    const node = this.must();
    return this.deps.book.list().map((peer) => ({
      id: peer.id,
      name: peer.name,
      addresses: peer.addresses,
      pairedAt: peer.pairedAt,
      lastSeen: peer.lastSeen,
      online: node.online(peer.id),
    }));
  }

  async forget(id: string): Promise<void> {
    if (!(await this.deps.book.forget(id))) throw notFound('Paired deck');
    this.must().drop(id);
  }

  async addAddress(id: string, address: string): Promise<void> {
    if (!this.deps.book.get(id)) throw notFound('Paired deck');
    await this.deps.book.reached(id, this.normalize(address));
  }

  async nearby(): Promise<NearbyDeck[]> {
    const found = await this.must().discover();
    return found.map((deck) => ({
      id: deck.id,
      name: deck.name,
      address: deck.address,
      paired: this.deps.book.get(deck.id) !== undefined,
    }));
  }

  tunnel(id: string): Promise<Tunnel> {
    if (!this.deps.book.get(id)) return Promise.reject(notFound('Paired deck'));
    return this.must().link(id);
  }

  /** `host` or `host:port` as `host:port`. */
  normalize(address: string): string {
    const parsed = parsePeerAddress(address, this.deps.peerPort);
    if (!parsed) throw invalid('Not an address (host or host:port)');
    return `${parsed.host}:${parsed.port}`;
  }

  must(): NetworkNode<Tunnel> {
    if (!this.node) throw new Error('The network is not started');
    return this.node;
  }

  private async startSharing(): Promise<void> {
    try {
      await this.must().share(this.deps.peerPort);
      this.error = null;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not listen';
    }
  }
}
