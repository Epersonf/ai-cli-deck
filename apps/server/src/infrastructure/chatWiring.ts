import { join } from 'node:path';
import { ChatActions } from '../application/ChatActions.js';
import { ChatService } from '../application/ChatService.js';
import { resolveCwd } from '../application/cwd.js';
import type { SessionManager } from '../application/SessionManager.js';
import type { EventBus } from '../domain/events.js';
import type { SystemPort } from '../domain/ports.js';
import type { ProviderRegistry } from '../domain/provider.js';
import { ChatFiles } from './chats/ChatFiles.js';
import { claudeChats } from './chats/claudeChats.js';
import { codexChats } from './chats/codexChats.js';
import { runGit } from './git/gitRun.js';

/** Where each session's CLI reports its chat; needed before any session starts. */
export const createChatFiles = (stateDir: string): ChatFiles =>
  new ChatFiles(join(stateDir, 'chat-reports'), runGit);

interface Deps {
  files: ChatFiles;
  sessions: SessionManager;
  providers: ProviderRegistry;
  bus: EventBus;
  system: SystemPort;
}

/** Conversations: knowing each terminal's, continuing them, and handing them between CLIs. */
export function chatServices({ files, sessions, providers, bus, system }: Deps) {
  const chats = new ChatService({
    sessions,
    providers,
    readers: { claude: claudeChats, codex: codexChats },
    files,
    bus,
  });
  const chatActions = new ChatActions({
    chats,
    sessions,
    files,
    providers,
    now: () => system.now(),
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });
  return { chats, chatActions, resolveCwd: (cwd: string) => resolveCwd(cwd, system.homeDir()) };
}
