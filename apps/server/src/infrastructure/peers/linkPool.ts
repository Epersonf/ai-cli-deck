import { dial } from './dial.js';
import type { SigningKey } from './keys.js';
import { Mux } from './mux.js';
import { initiateLink, type SecureLink } from './secureLink.js';
import { serveWith, type ServeTarget } from './tunnelServe.js';

export interface LinkPoolDeps {
  me: SigningKey;
  /** The port this deck accepts links on, sent so the other side can link back (null: not sharing). */
  myPort(): number | null;
  /** How this deck answers the other's requests; null when it does not share itself. */
  serve(): ServeTarget | null;
  keyOf(id: string): Buffer | null;
  /** Where to try, best first (known addresses, then what the network says now). */
  addressesOf(id: string): Promise<string[]>;
  /** A link to `id` is up, reached at `address` (null when it called us). */
  reached(id: string, address: string | null, port: number | null): void;
}

/** One open link per paired deck, opened on first use and shared by every request to it. */
export class LinkPool {
  private readonly links = new Map<string, Mux>();
  private readonly opening = new Map<string, Promise<Mux>>();

  constructor(private readonly deps: LinkPoolDeps) {}

  online(id: string): boolean {
    return this.links.has(id);
  }

  get(id: string): Promise<Mux> {
    const open = this.links.get(id);
    if (open && !open.closed) return Promise.resolve(open);
    const pending = this.opening.get(id) ?? this.connect(id);
    this.opening.set(id, pending);
    return pending.finally(() => this.opening.delete(id));
  }

  /** A link the other deck opened to us. */
  adopt(id: string, link: SecureLink, initiator: boolean): Mux {
    const serve = this.deps.serve();
    const mux = new Mux(link, initiator, serve ? serveWith(serve) : null);
    const previous = this.links.get(id);
    this.links.set(id, mux);
    if (previous && previous !== mux && !previous.busy) previous.close();
    mux.onClose(() => {
      if (this.links.get(id) === mux) this.links.delete(id);
    });
    return mux;
  }

  drop(id: string): void {
    this.links.get(id)?.close();
    this.links.delete(id);
  }

  closeAll(): void {
    for (const id of [...this.links.keys()]) this.drop(id);
  }

  private async connect(id: string): Promise<Mux> {
    const key = this.deps.keyOf(id);
    if (!key) throw new Error('Not a paired deck');
    let last: unknown = new Error('No known address for that deck');
    for (const address of await this.deps.addressesOf(id)) {
      try {
        const wire = await dial(address, '/link');
        const link = await initiateLink(wire, this.deps.me, key, this.deps.myPort());
        this.deps.reached(id, address, link.peerPort);
        return this.adopt(id, link, true);
      } catch (error) {
        last = error;
      }
    }
    throw last instanceof Error ? last : new Error('Cannot reach that deck');
  }
}
