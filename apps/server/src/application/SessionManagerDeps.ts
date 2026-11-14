import type { AgentPort } from '../domain/agent.js';
import type { EventBus } from '../domain/events.js';
import type { ChatLogPort, SessionStorePort, SystemPort } from '../domain/ports.js';
import type { ProviderRegistry } from '../domain/provider.js';
import type { AgentLauncher } from './AgentLauncher.js';
import type { LimitBook } from './LimitBook.js';
import type { PortAllocator } from './PortAllocator.js';
import type { ModelBook } from './ModelBook.js';
import type { ModelCatalog } from './ModelCatalog.js';
import type { UsageHistoryStore } from './UsageHistoryStore.js';

export interface SessionManagerDeps {
  launcher: AgentLauncher;
  usageHistoryStore?: UsageHistoryStore;
  agent: AgentPort;
  providers: ProviderRegistry;
  store: SessionStorePort;
  log: ChatLogPort;
  ports: PortAllocator;
  system: SystemPort;
  bus: EventBus;
  /** What each account's usage window last said; shared by its sessions. */
  limits: LimitBook;
  /** The default and last-answering model of each provider. */
  models: ModelBook;
  /** The models each provider offers. */
  catalog: ModelCatalog;
}

export interface CreateOptions {
  /** Continue this saved conversation (as a copy when `fork`). */
  chatId?: string | null;
  fork?: boolean;
  /** Notes to start with (a side chat keeps its source's model, mode and effort). */
  meta?: Record<string, string>;
  /** Copy stable instructions for a native fork. */
  briefingFrom?: string;
}
