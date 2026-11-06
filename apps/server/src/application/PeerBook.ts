import type { NetworkState, NetworkStorePort, PeerRecord } from '../domain/network.js';

/** Addresses kept per deck (the most recent ones). */
const MAX_ADDRESSES = 5;

const merge = (first: string[], rest: string[]): string[] =>
  [...new Set([...first, ...rest])].slice(0, MAX_ADDRESSES);

/** The paired decks and the sharing setting, saved on every change. */
export class PeerBook {
  private constructor(
    private state: NetworkState,
    private readonly store: NetworkStorePort,
    private readonly now: () => Date,
  ) {}

  static async open(store: NetworkStorePort, now: () => Date): Promise<PeerBook> {
    return new PeerBook(await store.load(), store, now);
  }

  get sharing(): boolean {
    return this.state.sharing;
  }

  get name(): string | null {
    return this.state.name;
  }

  list(): readonly PeerRecord[] {
    return this.state.peers;
  }

  get(id: string): PeerRecord | undefined {
    return this.state.peers.find((peer) => peer.id === id);
  }

  byKey(key: string): PeerRecord | undefined {
    return this.state.peers.find((peer) => peer.key === key);
  }

  async settings(patch: { sharing?: boolean; name?: string | null }): Promise<void> {
    await this.write({ ...this.state, ...patch });
  }

  /** Records a pairing (again, for a deck paired before: its name and address are refreshed). */
  async pair(peer: Omit<PeerRecord, 'pairedAt' | 'lastSeen'>): Promise<PeerRecord> {
    const now = this.now().toISOString();
    const known = this.get(peer.id);
    const record: PeerRecord = {
      ...peer,
      addresses: merge(peer.addresses, known?.addresses ?? []),
      pairedAt: now,
      lastSeen: now,
    };
    await this.write({ ...this.state, peers: [record, ...this.others(peer.id)] });
    return record;
  }

  async forget(id: string): Promise<boolean> {
    if (!this.get(id)) return false;
    await this.write({ ...this.state, peers: this.others(id) });
    return true;
  }

  /** A deck was reached (or reached us) at `address`: it goes first in its list. */
  async reached(id: string, address: string | null): Promise<void> {
    const peer = this.get(id);
    if (!peer) return;
    const addresses = address ? merge([address], peer.addresses) : peer.addresses;
    const updated = { ...peer, addresses, lastSeen: this.now().toISOString() };
    const peers = this.state.peers.map((p) => (p.id === id ? updated : p));
    await this.write({ ...this.state, peers });
  }

  private others(id: string): PeerRecord[] {
    return this.state.peers.filter((peer) => peer.id !== id);
  }

  private async write(next: NetworkState): Promise<void> {
    this.state = next;
    await this.store.save(next);
  }
}
