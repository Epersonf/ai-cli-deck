import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AgentKind, ChatFormat } from '@deck/shared';
import type { ChatSupport } from '../../domain/chat.js';

/** Where an agent keeps its chats when the profile does not give it a folder of its own. */
export function defaultChatHome(kind: ChatFormat, env: NodeJS.ProcessEnv = process.env): string {
  if (kind === 'claude') return env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');
  return env.CODEX_HOME ?? join(homedir(), '.codex');
}

/** The chat files of an agent: Claude's and Codex's are the formats the deck can read. */
export function chatSupport(kind: AgentKind, home: string | null): ChatSupport | null {
  if (kind !== 'claude' && kind !== 'codex') return null;
  return { format: kind, home: home ?? defaultChatHome(kind) };
}
