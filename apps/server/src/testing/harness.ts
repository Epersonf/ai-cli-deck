import type { Session } from '@deck/shared';
import { ChatActions } from '../application/ChatActions.js';
import { ChatService } from '../application/ChatService.js';
import { TaskService } from '../application/TaskService.js';
import { PortAllocator } from '../application/PortAllocator.js';
import { SessionLauncher } from '../application/SessionLauncher.js';
import { SessionManager } from '../application/SessionManager.js';
import { EventBus, type DeckEvent } from '../domain/events.js';
import { createProviderRegistry } from '../infrastructure/providers/registry.js';
import {
  FakeChatFiles,
  FakeChatReader,
  FakeMux,
  FakePtyPort,
  FakeScrollback,
  FakeStore,
  FakeSystem,
} from './fakes.js';

export interface HarnessOptions {
  tmux?: boolean;
  liveTmux?: string[];
  stored?: Session[];
  scrollback?: FakeScrollback;
}

export function createHarness(options: HarnessOptions = {}) {
  const ptyPort = new FakePtyPort();
  const mux = new FakeMux(options.tmux ?? true, options.liveTmux ?? [], ptyPort);
  const store = new FakeStore(options.stored ?? []);
  const system = new FakeSystem();
  const scrollback = options.scrollback ?? new FakeScrollback();
  const bus = new EventBus();
  const events: DeckEvent[] = [];
  bus.subscribe((e) => events.push(e));
  const providers = createProviderRegistry();
  const launcher = new SessionLauncher({
    mux,
    providers,
    mcpBaseUrl: 'http://127.0.0.1:7842/mcp',
    deckUrl: 'http://127.0.0.1:7842',
    binDir: '/deck/bin',
    baseEnv: { PATH: '/bin' },
    defaultShell: 'bash',
    chatReportFile: (id) => `/reports/${id}.json`,
  });
  const sessions = new SessionManager({
    launcher,
    mux,
    store,
    scrollback,
    ports: new PortAllocator({ min: 4100, max: 4109 }, () => Promise.resolve(true)),
    system,
    bus,
    replayBytes: 1024,
  });
  const chatFiles = new FakeChatFiles();
  const reader = new FakeChatReader();
  const readers = { claude: reader, codex: reader };
  const chats = new ChatService({ sessions, providers, readers, files: chatFiles, bus });
  const chatActions = new ChatActions({
    chats,
    sessions,
    files: chatFiles,
    providers,
    now: () => system.now(),
    wait: () => Promise.resolve(),
  });
  const tasks = new TaskService({
    sessions,
    bus,
    phone: null,
    pty: ptyPort,
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
    ptyPort,
    mux,
    store,
    scrollback,
    system,
    bus,
    events,
  };
}

export const customBody = (cwd = '/work', useWorktree = false) => ({
  provider: 'custom',
  cwd,
  useWorktree,
  command: 'bash',
  args: [] as string[],
});
