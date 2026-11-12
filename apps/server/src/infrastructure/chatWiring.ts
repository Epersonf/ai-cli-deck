import { ChatActions } from '../application/ChatActions.js';
import { ChatService } from '../application/ChatService.js';
import { resolveCwd } from '../application/cwd.js';
import type { SessionManager } from '../application/SessionManager.js';
import type { SystemPort } from '../domain/ports.js';
import type { ProviderRegistry } from '../domain/provider.js';
import { ChatFiles } from './chats/ChatFiles.js';
import { claudeChats } from './chats/claudeChats.js';
import { codexChats } from './chats/codexChats.js';
import { runGit } from './git/gitRun.js';

interface Deps {
  sessions: SessionManager;
  providers: ProviderRegistry;
  system: SystemPort;
}

/** Conversations: knowing each session's, and carrying them over between agents. */
export function chatServices({ sessions, providers, system }: Deps) {
  const chats = new ChatService({
    sessions,
    providers,
    readers: { claude: claudeChats, codex: codexChats },
  });
  const chatActions = new ChatActions({
    chats,
    sessions,
    files: new ChatFiles(runGit),
    providers,
    now: () => system.now(),
  });
  return { chats, chatActions, resolveCwd: (cwd: string) => resolveCwd(cwd, system.homeDir()) };
}
