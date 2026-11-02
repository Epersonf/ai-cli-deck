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

  runtimeOf(session: Session): Runtime {
    return { session, pty: null, ring: new RingBuffer(this.replayBytes) };
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
