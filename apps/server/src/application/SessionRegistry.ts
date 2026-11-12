import type { Session } from '@deck/shared';
import { notFound } from '../domain/errors.js';
import type { EventBus } from '../domain/events.js';
import type { SessionStorePort } from '../domain/ports.js';
import type { ChatRuntime } from './ChatRuntime.js';
import { withSharedCwd } from './sharedCwd.js';

export interface Runtime {
  session: Session;
  chat: ChatRuntime;
}

/** Every known session with its conversation; changes are persisted and published. */
export class SessionRegistry {
  readonly runtimes = new Map<string, Runtime>();

  constructor(
    private readonly store: SessionStorePort,
    private readonly bus: EventBus,
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

  /** The main session a side chat opened from `id` belongs to (`id` itself for a main session). */
  rootOf(id: string): string {
    return this.require(id).session.parentId ?? id;
  }

  childrenOf(id: string): Session[] {
    return this.list().filter((s) => s.parentId === id);
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
