import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ChatFormat, TemplateChat } from '@deck/shared';
import type { ChatSupport } from '../../domain/chat.js';

/**
 * Claude Code runs this each time a chat starts (new, resumed, cleared, compacted) with the chat id on
 * stdin; it only saves that, prints nothing (a SessionStart hook's output would reach the model).
 */
const CLAUDE_TRACK = [
  '--settings',
  JSON.stringify({
    hooks: {
      SessionStart: [{ hooks: [{ type: 'command', command: 'cat > "$DECK_CHAT_FILE"' }] }],
    },
  }),
];

export const CLAUDE_CHAT: TemplateChat = {
  format: 'claude',
  resume: ['--resume', '{chatId}'],
  fork: ['--resume', '{chatId}', '--fork-session'],
  last: ['--continue'],
  prompt: ['{prompt}'],
};

export const CODEX_CHAT: TemplateChat = {
  format: 'codex',
  resume: ['resume', '{chatId}'],
  fork: ['fork', '{chatId}'],
  last: ['resume', '--last'],
  prompt: ['{prompt}'],
};

/** Where a CLI keeps its chats when the profile does not give it a folder of its own. */
export function defaultChatHome(
  format: ChatFormat | null,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (format === 'claude') return env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');
  if (format === 'codex') return env.CODEX_HOME ?? join(homedir(), '.codex');
  return null;
}

const using = (args: readonly string[], name: string) =>
  args.length === 0
    ? null
    : (value: string): string[] => args.map((arg) => arg.replaceAll(`{${name}}`, value));

/** A template's (or a built-in CLI's) chat description as what the deck can do with it. */
export function chatSupport(spec: TemplateChat | null, home: string | null): ChatSupport | null {
  if (!spec) return null;
  return {
    format: spec.format,
    home: home ?? defaultChatHome(spec.format),
    resume: using(spec.resume, 'chatId'),
    fork: using(spec.fork, 'chatId'),
    last: spec.last.length > 0 ? [...spec.last] : null,
    prompt: using(spec.prompt, 'prompt'),
    track: spec.format === 'claude' ? CLAUDE_TRACK : [],
  };
}
