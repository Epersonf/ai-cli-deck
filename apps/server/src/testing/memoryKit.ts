import type { MemoryTree } from '@deck/shared';
import type { AgentMemoryDeps } from '../application/AgentMemory.js';
import type { ApprovalService } from '../application/ApprovalService.js';
import { MemoryService, type MemoryStorePort } from '../application/MemoryService.js';
import type { EventBus } from '../domain/events.js';
import type { ProviderRegistry } from '../domain/provider.js';
import type { SessionManager } from '../application/SessionManager.js';

/** Notes kept in a map instead of files. */
export class FakeMemoryStore implements MemoryStorePort {
  readonly files = new Map<string, MemoryTree>();
  loadAll = () => Promise.resolve(Object.fromEntries(this.files));
  save = (key: string, tree: MemoryTree) => Promise.resolve(void this.files.set(key, tree));
  remove = (key: string) => Promise.resolve(void this.files.delete(key));
}

/** A memory service on fakes with ids m1, m2... */
export function fakeMemory(bus: EventBus, store = new FakeMemoryStore()): MemoryService {
  let n = 0;
  return new MemoryService({
    store,
    bus,
    newId: () => `m${++n}`,
    now: () => new Date('2026-01-01T00:00:00Z'),
  });
}

/** What the agents' memory tool works with, over a memory service. */
export function memoryAccess(
  memory: MemoryService,
  parts: { approvals: ApprovalService; providers: ProviderRegistry; sessions: SessionManager },
): AgentMemoryDeps {
  const { approvals, providers, sessions } = parts;
  return {
    memory,
    approvals,
    providers,
    profileOf: (id) => sessions.get(id)?.provider ?? '',
    notice: (id, text) => sessions.notice(id, text),
  };
}
