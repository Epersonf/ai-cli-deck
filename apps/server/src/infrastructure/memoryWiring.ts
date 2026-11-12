import { join } from 'node:path';
import { LimitBook } from '../application/LimitBook.js';
import { MemoryService } from '../application/MemoryService.js';
import { ModelBook } from '../application/ModelBook.js';
import { ModelCatalog } from '../application/ModelCatalog.js';
import type { EventBus } from '../domain/events.js';
import type { SystemPort } from '../domain/ports.js';
import type { ProviderRegistry } from '../domain/provider.js';
import { JsonLimitStore } from './store/JsonLimitStore.js';
import { JsonMemoryStore } from './store/JsonMemoryStore.js';
import { JsonModelStore } from './store/JsonModelStore.js';

interface Deps {
  configDir: string;
  stateDir: string;
  providers: ProviderRegistry;
  bus: EventBus;
  system: SystemPort;
}

/**
 * What the deck keeps between runs: usage limits, default models and modes, which models are on offer, and the
 * notes (memory). `launcher` is what the agent launcher reads from them when a run starts.
 */
export async function memoryServices({ configDir, stateDir, providers, bus, system }: Deps) {
  const limits = new LimitBook(new JsonLimitStore(join(stateDir, 'limits.json')));
  const models = new ModelBook(new JsonModelStore(join(stateDir, 'models.json')));
  const memory = new MemoryService({
    store: new JsonMemoryStore(join(configDir, 'memory')),
    bus,
    newId: () => system.newId(),
    now: () => system.now(),
  });
  await Promise.all([limits.restore(), models.restore(), memory.restore()]);
  return {
    limits,
    models,
    memory,
    catalog: new ModelCatalog(providers),
    launcher: {
      defaultModel: (id: string) => models.defaultOf(id),
      defaultMode: (id: string) => models.modeOf(id),
      memoryBriefing: (id: string) => memory.briefing(id),
    },
  };
}
