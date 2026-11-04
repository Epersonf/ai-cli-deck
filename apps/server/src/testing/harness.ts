import type { Session } from '@deck/shared';
import { HandoffService } from '../application/HandoffService.js';
import { PortAllocator } from '../application/PortAllocator.js';
import { SessionLauncher } from '../application/SessionLauncher.js';
import { SessionManager } from '../application/SessionManager.js';
import { EventBus, type DeckEvent } from '../domain/events.js';
import { createProviderRegistry } from '../infrastructure/providers/registry.js';
import {
  FakeHandoffs,
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
  const mux = new FakeMux(options.tmux ?? true, options.liveTmux ?? []);
  const store = new FakeStore(options.stored ?? []);
  const system = new FakeSystem();
  const scrollback = options.scrollback ?? new FakeScrollback();
  const bus = new EventBus();
  const events: DeckEvent[] = [];
  bus.subscribe((e) => events.push(e));
  const launcher = new SessionLauncher({
    pty: ptyPort,
    mux,
    providers: createProviderRegistry(),
    mcpBaseUrl: 'http://127.0.0.1:7842/mcp',
    deckUrl: 'http://127.0.0.1:7842',
    binDir: '/deck/bin',
    baseEnv: { PATH: '/bin' },
    defaultShell: 'bash',
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
  const handoffStore = new FakeHandoffs();
  const handoffs = new HandoffService(sessions, handoffStore, () => Promise.resolve());
  return { sessions, handoffs, handoffStore, ptyPort, mux, store, scrollback, system, bus, events };
}

export const customBody = (cwd = '/work', useWorktree = false) => ({
  provider: 'custom',
  cwd,
  useWorktree,
  command: 'bash',
  args: [] as string[],
});
