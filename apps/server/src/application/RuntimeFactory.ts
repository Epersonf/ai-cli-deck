import type { UsageHistoryStore } from './UsageHistoryStore.js';
import { randomUUID } from 'node:crypto';
import type { Session } from '@deck/shared';
import type { AgentConfig, AgentPort } from '../domain/agent.js';
import type { EventBus } from '../domain/events.js';
import type { ChatLogPort, SystemPort } from '../domain/ports.js';
import type { ProviderRegistry } from '../domain/provider.js';
import type { AgentLauncher } from './AgentLauncher.js';
import { ChatRuntime } from './ChatRuntime.js';
import type { LimitBook } from './LimitBook.js';
import type { ModelBook } from './ModelBook.js';
import type { ModelCatalog } from './ModelCatalog.js';
import { modelSource } from './modelSource.js';
import type { SessionRegistry } from './SessionRegistry.js';
import { UsageMeter } from './UsageMeter.js';

export interface FactoryDeps {
  reg: SessionRegistry;
  launcher: AgentLauncher;
  usageHistoryStore?: UsageHistoryStore;
  agent: AgentPort;
  providers: ProviderRegistry;
  log: ChatLogPort;
  bus: EventBus;
  system: SystemPort;
  limits: LimitBook;
  models: ModelBook;
  catalog: ModelCatalog;
  remember(id: string, patch: { chatId?: string; config?: AgentConfig }): void;
}

/** Builds the conversation of a session: its agent, log, usage meter and the way it saves its state. */
export class RuntimeFactory {
  constructor(private readonly d: FactoryDeps) {}

  make(session: Session, from: { chatId: string | null; fork: boolean }): ChatRuntime {
    const { launcher, providers, agent, log, bus, system, limits, reg } = this.d;
    const provider = providers.get(session.provider);
    const id = session.id;
    return new ChatRuntime({
      id,
      agent,
      log,
      bus,
      meter: new UsageMeter(
        limits,
        session.provider,
        () => system.now(),
        this.d.usageHistoryStore ? { store: this.d.usageHistoryStore, sessionId: id } : undefined,
      ),
      uuid: randomUUID,
      now: () => system.now(),
      spec: (state) => launcher.spec(reg.require(id).session, state),
      remember: (patch) => this.d.remember(id, patch),
      busy: (busy) => reg.update(id, { status: busy ? 'working' : 'idle' }),
      info: {
        agent: provider?.agent ?? 'claude',
        models: modelSource(session.provider, this.d.models, this.d.catalog),
        label: provider?.label ?? session.provider,
      },
      initial: { config: launcher.initialConfig(session), ...from },
    });
  }
}
