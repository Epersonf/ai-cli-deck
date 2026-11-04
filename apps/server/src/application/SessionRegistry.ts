import type { Session } from '@deck/shared';
import { notFound } from '../domain/errors.js';
import type { EventBus } from '../domain/events.js';
import type { PtyHandle, SessionStorePort } from '../domain/ports.js';
import { RingBuffer } from './RingBuffer.js';
import { withSharedCwd } from './sharedCwd.js';

export interface Runtime {
  session: Session;
  pty: PtyHandle | null;
  ring: RingBuffer;
  /** The size the program was last given (null until a device sets one). */
  size: { cols: number; rows: number } | null;
}

/** Every known session with its pty and replay buffer; changes are persisted and published. */
export class SessionRegistry {
  readonly runtimes = new Map<string, Runtime>();

  constructor(
    private readonly store: SessionStorePort,
    private readonly bus: EventBus,
    private readonly replayBytes: number,
  ) {}

  list(): Session[] {
    return withSharedCwd([...this.runtimes.values()].map((r) => r.session));
  }

  get(id: string): Session | undefined {
    return this.list().find((s) => s.id === id);
  }

  require(id: string): Runtime {
    const runtime = this.runtimes.get(id);
    if (!runtime) throw notFound(`Session ${id}`);
    return runtime;
  }

  /** The main session a sub-terminal opened from `id` belongs to (`id` itself for a main session). */
  rootOf(id: string): string {
    return this.require(id).session.parentId ?? id;
  }

  childrenOf(id: string): Session[] {
    return this.list().filter((s) => s.parentId === id);
  }

  runtimeOf(session: Session): Runtime {
    return { session, pty: null, ring: new RingBuffer(this.replayBytes), size: null };
  }

  /** Records a new terminal size and tells every device; false when it is the size already in use. */
  setSize(id: string, cols: number, rows: number): boolean {
    const runtime = this.require(id);
    if (runtime.size?.cols === cols && runtime.size.rows === rows) return false;
    runtime.size = { cols, rows };
    this.bus.publish({ kind: 'size', sessionId: id, cols, rows });
    return true;
  }

  update(id: string, patch: Partial<Session>): void {
    const runtime = this.require(id);
    runtime.session = { ...runtime.session, ...patch };
    const fresh = this.get(id);
    if (fresh) this.bus.publish({ kind: 'session', session: fresh });
  }

  persist(): Promise<void> {
    return this.store.save([...this.runtimes.values()].map((r) => r.session));
  }
}
