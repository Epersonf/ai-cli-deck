import type { ShownCode } from './network.js';

/** A deck that answered on the network. */
export interface FoundDeck {
  id: string;
  name: string;
  address: string;
}

/** The asking side of a pairing, while the user reads the code on the other screen. */
export interface PendingAsk {
  key: Buffer;
  name: string;
  port: number | null;
  submit(code: string): Promise<{ left: number } | null>;
  close(): void;
}

/** What the network service needs from the transport (implemented by `PeerNode`). */
export interface NetworkNode<Tunnel> {
  readonly id: string;
  readonly port: number | null;
  share(port: number): Promise<void>;
  unshare(): Promise<void>;
  discover(): Promise<FoundDeck[]>;
  ask(address: string): Promise<PendingAsk>;
  link(id: string): Promise<Tunnel>;
  online(id: string): boolean;
  drop(id: string): void;
}

/** Callbacks the transport makes into the service (see `PeerNodeHooks`). */
export interface NetworkHooks {
  name(): string;
  known(key: Buffer): boolean;
  show(asker: { name: string; key: Buffer }): ShownCode;
  paired(peer: { key: Buffer; name: string; port: number | null }, ip: string): void;
  keyOf(id: string): Buffer | null;
  addresses(id: string): string[];
  reached(id: string, address: string | null, ip: string | null, port: number | null): void;
}
