import type { Session } from '@deck/shared';
import { AgentLauncher } from '../application/AgentLauncher.js';
import { ChatActions } from '../application/ChatActions.js';
import { ChatService } from '../application/ChatService.js';
import { TaskService } from '../application/TaskService.js';
import { LimitBook } from '../application/LimitBook.js';
import type { ModelListing } from '../domain/provider.js';
import { fakeMemory } from './memoryKit.js';
import { ModelBook } from '../application/ModelBook.js';
import { ModelCatalog } from '../application/ModelCatalog.js';
import { PortAllocator } from '../application/PortAllocator.js';
import { SessionManager } from '../application/SessionManager.js';
import { EventBus, type DeckEvent } from '../domain/events.js';
import { createProviderRegistry } from '../infrastructure/providers/registry.js';
import { FakeAgentPort, FakeChatLog, FakeProcessPort } from './fakeAgent.js';
import { FakeChatFiles, FakeChatReader, FakeStore, FakeSystem } from './fakes.js';

export interface HarnessOptions {
  stored?: Session[];
  log?: FakeChatLog;
}

export function createHarness(options: HarnessOptions = {}) {
  const agent = new FakeAgentPort();
  const processes = new FakeProcessPort();
  const store = new FakeStore(options.stored ?? []);
  const system = new FakeSystem();
  const log = options.log ?? new FakeChatLog();
  const bus = new EventBus();
  const events: DeckEvent[] = [];
  bus.subscribe((e) => events.push(e));
  const providers = createProviderRegistry();
  // Never ask the real agents which models they have: tests set what they answer.
  const listing: ModelListing = { choices: [], current: null };
  for (const p of providers.list())
    providers.add({ ...p, discoverModels: () => Promise.resolve(listing) });
  const memory = fakeMemory(bus);
  const models = new ModelBook();
  const catalog = new ModelCatalog(providers);
  const launcher = new AgentLauncher({
    providers,
    defaultModel: (id) => models.defaultOf(id),
    defaultMode: (id) => models.modeOf(id),
    memoryBriefing: (id) => memory.briefing(id),
    mcpBaseUrl: 'http://127.0.0.1:7842/mcp',
    deckUrl: 'http://127.0.0.1:7842',
    binDir: '/deck/bin',
    baseEnv: { PATH: '/bin' },
  });
  const limits = new LimitBook();
  const sessions = new SessionManager({
    launcher,
    agent,
    providers,
    store,
    log,
    ports: new PortAllocator({ min: 4100, max: 4109 }, () => Promise.resolve(true)),
    system,
    bus,
    limits,
    models,
    catalog,
  });
  const chatFiles = new FakeChatFiles();
  const reader = new FakeChatReader();
  const chats = new ChatService({
    sessions,
    providers,
    readers: { claude: reader, codex: reader },
  });
  const chatActions = new ChatActions({
    chats,
    sessions,
    files: chatFiles,
    providers,
    now: () => system.now(),
  });
  const tasks = new TaskService({
    sessions,
    bus,
    phone: null,
    processes,
    envFor: () => ({}),
    shell: (line) => ({ command: 'sh', args: ['-c', line] }),
    now: () => 0,
    newId: () => system.newId(),
  });
  return {
    tasks,
    providers,
    sessions,
    chats,
    chatActions,
    chatFiles,
    reader,
    agent,
    processes,
    launcher,
    store,
    log,
    system,
    bus,
    events,
    limits,
    models,
    catalog,
    listing,
    memory,
  };
}

/** The body of a new session with the built-in Claude provider. */
export const agentBody = (cwd = '/work', useWorktree = false) => ({
  provider: 'claude',
  cwd,
  useWorktree,
  chatId: null,
});
