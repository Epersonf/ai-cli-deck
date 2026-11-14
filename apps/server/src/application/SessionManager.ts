import { CHAT_META, type CreateSessionBody, type Session } from '@deck/shared';
import type { AgentPort } from '../domain/agent.js';
import type { EventBus } from '../domain/events.js';
import type { ChatLogPort, SessionStorePort, SystemPort } from '../domain/ports.js';
import type { ProviderRegistry } from '../domain/provider.js';
import type { AgentLauncher } from './AgentLauncher.js';
import type { LimitBook } from './LimitBook.js';
import { LimitProbe } from './LimitProbe.js';
import type { PortAllocator } from './PortAllocator.js';
import { existingDir } from './cwd.js';
import { newSession } from './newSession.js';
import { RuntimeFactory } from './RuntimeFactory.js';
import { SessionChats } from './SessionChats.js';
import { SessionEdits } from './SessionEdits.js';
import { SessionRegistry, type Runtime } from './SessionRegistry.js';
import type { ModelBook } from './ModelBook.js';
import type { ModelCatalog } from './ModelCatalog.js';
import { withMeta } from './sessionMeta.js';

export interface SessionManagerDeps {
  launcher: AgentLauncher;
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
}

/** The sessions: each one a conversation with an agent, started on its first message. */
export class SessionManager extends SessionChats {
  private readonly edits: SessionEdits;
  private readonly runtimes: RuntimeFactory;
  private readonly probe: LimitProbe;

  constructor(private readonly deps: SessionManagerDeps) {
    const reg = new SessionRegistry(deps.store, deps.bus);
    super(reg);
    this.edits = new SessionEdits(reg, deps.system);
    this.probe = new LimitProbe(deps.providers, deps.limits);
    this.runtimes = new RuntimeFactory({
      ...deps,
      reg,
      remember: (id, patch) => void this.edits.remember(id, patch),
    });
    // The default model and the list of models are the same in every chat of that provider.
    const modelsMoved = (provider: string, defaultChanged: boolean): void => {
      for (const { session, chat } of reg.runtimes.values())
        if (session.provider === provider) chat.modelsChanged(defaultChanged);
    };
    deps.models.onDefaultChange((provider) => modelsMoved(provider, true));
    deps.catalog.onChange((provider) => modelsMoved(provider, false));
    // An account's limit is the same in every chat of that profile: tell them all when it moves.
    deps.limits.onChange((account) => {
      for (const { session, chat } of reg.runtimes.values()) {
        if (session.provider === account) chat.pushUsage();
      }
    });
  }

  /** Asks the chat's account for its usage windows now, so they show before its first answer. */
  readonly refreshLimits = (id: string): Promise<void> =>
    this.probe.refresh(this.reg.require(id).session.provider);

  readonly list = (): Session[] => this.reg.list();
  readonly get = (id: string): Session | undefined => this.reg.get(id);

  async create(body: CreateSessionBody, options: CreateOptions = {}): Promise<Session> {
    const { system, ports } = this.deps;
    const parentId = body.parentId ? this.reg.rootOf(body.parentId) : null;
    const cwd = await existingDir(system, body.cwd, false);
    const session = newSession({ ...body, parentId }, cwd, await ports.allocate(), {
      id: system.newId(),
      now: system.now(),
    });
    session.meta = options.meta ?? {};
    const chatId = options.chatId ?? body.chatId;
    if (chatId) session.meta = withMeta(session.meta, CHAT_META.chat, chatId);
    try {
      const from = { chatId: chatId ?? null, fork: options.fork ?? false };
      this.reg.runtimes.set(session.id, { session, chat: this.runtimes.make(session, from) });
    } catch (error) {
      ports.release(session.port);
      throw error;
    }
    await this.reg.persist();
    this.deps.bus.publish({ kind: 'session', session });
    return this.get(session.id) ?? session;
  }

  /** After a server restart: every saved session is back, idle, with its conversation on disk. */
  async restore(): Promise<void> {
    for (const saved of await this.deps.store.load()) {
      this.deps.ports.reserve(saved.port);
      const session: Session = { ...saved, status: 'idle' };
      const from = { chatId: session.meta[CHAT_META.chat] ?? null, fork: false };
      this.reg.runtimes.set(session.id, { session, chat: this.runtimes.make(session, from) });
    }
  }

  async remove(id: string): Promise<void> {
    const runtime = this.reg.require(id);
    for (const child of this.reg.childrenOf(id)) await this.remove(child.id);
    runtime.chat.close();
    await this.deps.log.remove(id).catch(() => undefined);
    this.deps.ports.release(runtime.session.port);
    this.reg.runtimes.delete(id);
    this.deps.bus.publish({ kind: 'removed', sessionId: id });
    await this.reg.persist();
  }

  async switchProvider(id: string, provider: string): Promise<void> {
    const runtime: Runtime = this.reg.require(id);
    runtime.chat.close();
    this.reg.update(id, { provider, meta: withMeta(runtime.session.meta, CHAT_META.chat, '') });
    const session = this.reg.require(id).session;
    const chat = this.runtimes.make(session, { chatId: null, fork: false });
    await chat.seed(runtime.chat.recent());
    this.reg.runtimes.set(id, { session, chat });
    await this.reg.persist();
  }

  readonly setMeta = (id: string, key: string, value: string) => this.edits.setMeta(id, key, value);
  readonly rename = (id: string, name: string | null) => this.edits.rename(id, name);
  readonly setPreview = (id: string, url: string) => this.edits.setPreview(id, url);
  readonly setCwd = (id: string, path: string) => this.edits.setCwd(id, path);
  readonly applyWorktree = (id: string, path: string, branch: string) =>
    this.edits.applyWorktree(id, path, branch);
}
