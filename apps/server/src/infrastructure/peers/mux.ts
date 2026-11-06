import type { Head } from './frameCipher.js';
import type { SecureLink } from './channel.js';

/** Unsent bytes above which a sender waits (keeps memory flat on a slow link). */
const HIGH_WATER = 1 << 20;
/** Unsent bytes at which a live socket (a terminal) is cut off: it reconnects to a fresh screen. */
const OVERLOAD = 8 << 20;
const PING_MS = 15_000;
const DEAD_MS = 45_000;

export interface StreamHandler {
  frame(head: Head, body: Buffer): void;
  /** The link went away (or the other side aborted) before the stream ended. */
  drop(reason: string): void;
}

/** Streams over one secure link: HTTP requests and WebSockets, either direction, each with an id. */
export class Mux {
  private readonly streams = new Map<number, StreamHandler>();
  private nextId: number;
  private lastPong = Date.now();
  private readonly timer: ReturnType<typeof setInterval>;
  private closeListeners: (() => void)[] = [];
  closed = false;

  constructor(
    readonly link: SecureLink,
    initiator: boolean,
    private readonly serve: ((mux: Mux, head: Head) => void) | null,
  ) {
    this.nextId = initiator ? 1 : 2; // never the same id from both sides
    link.onFrame((head, body) => this.dispatch(head, body));
    link.onClose(() => this.shut());
    this.timer = setInterval(() => this.heartbeat(), PING_MS);
    this.timer.unref?.();
  }

  open(handler: StreamHandler): number {
    const id = this.nextId;
    this.nextId += 2;
    this.streams.set(id, handler);
    return id;
  }

  /** Registers the handler of a stream the other side opened. */
  adopt(id: number, handler: StreamHandler): void {
    this.streams.set(id, handler);
  }

  end(id: number): void {
    this.streams.delete(id);
  }

  send(head: Head, body?: Uint8Array): void {
    if (!this.closed) this.link.send(head, body);
  }

  /** Resolves once the link has room for more (or is gone). */
  async drain(): Promise<void> {
    while (!this.closed && this.link.buffered() > HIGH_WATER) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  get overloaded(): boolean {
    return this.link.buffered() > OVERLOAD;
  }

  get busy(): boolean {
    return this.streams.size > 0;
  }

  onClose(listener: () => void): void {
    if (this.closed) listener();
    else this.closeListeners.push(listener);
  }

  close(): void {
    this.link.close();
    this.shut();
  }

  private dispatch(head: Head, body: Buffer): void {
    if (head.k === 'ping') return this.send({ k: 'pong' });
    if (head.k === 'pong') return void (this.lastPong = Date.now());
    if (head.k === 'req' || head.k === 'wso') {
      if (this.serve) return this.serve(this, head);
      return this.send({ k: 'x', s: head.s, msg: 'This deck does not serve requests' });
    }
    const handler = typeof head.s === 'number' ? this.streams.get(head.s) : undefined;
    handler?.frame(head, body);
  }

  private heartbeat(): void {
    if (Date.now() - this.lastPong > DEAD_MS) return this.close();
    this.send({ k: 'ping' });
  }

  private shut(): void {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.timer);
    for (const handler of this.streams.values()) handler.drop('The link to the other deck closed');
    this.streams.clear();
    this.closeListeners.splice(0).forEach((listener) => listener());
  }
}
