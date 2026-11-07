import type { CommandParts, Provider, ProviderContext } from '../../domain/provider.js';
import { CLAUDE_CHAT, chatSupport } from '../chats/chatSupport.js';
import { claudeEndpointParts } from './claudeEndpoint.js';
import { claudeMcpConfig } from './claudeLike.js';

/** DeepSeek is a ready-made endpoint: the URL and models are fixed, only the key is yours. */
export const DEEPSEEK_ENV = {
  ANTHROPIC_MODEL: 'deepseek-chat',
  ANTHROPIC_DEFAULT_HAIKU_MODEL: 'deepseek-chat',
  // Claude Code does not know this model: without the real window it warns and assumes 200k.
  CLAUDE_CODE_MAX_CONTEXT_TOKENS: '128000',
} as const;
export const DEEPSEEK_URL = 'https://api.deepseek.com/anthropic';

export function deepseekParts(ctx: ProviderContext, saveDir: string | null): CommandParts {
  return claudeEndpointParts(ctx, {
    baseUrl: DEEPSEEK_URL,
    env: DEEPSEEK_ENV,
    keyLabel: 'DeepSeek API key',
    saveDir,
  });
}

export const claudeDeepseek: Provider = {
  id: 'claude-deepseek',
  label: 'Claude Code (DeepSeek)',
  buildCommand: (ctx) => deepseekParts(ctx, null),
  buildMcpConfig: claudeMcpConfig,
  chat: chatSupport(CLAUDE_CHAT, null),
};
