import type {
  CommandParts,
  McpInjection,
  Provider,
  ProviderContext,
} from '../../domain/provider.js';

import { AGENT_GUIDE } from './agentGuide.js';

export function claudeMcpConfig(ctx: ProviderContext): McpInjection {
  const config = { mcpServers: { deck: { type: 'http', url: ctx.mcpUrl } } };
  return {
    args: ['--mcp-config', JSON.stringify(config), '--append-system-prompt', AGENT_GUIDE],
    env: {},
  };
}

/** Shared by every provider that launches the Claude Code CLI. */
export function createClaudeLike(
  id: string,
  label: string,
  extraEnv: (ctx: ProviderContext) => Record<string, string> = () => ({}),
): Provider {
  return {
    id,
    label,
    buildCommand: (ctx): CommandParts => ({
      command: 'claude',
      args: [...ctx.args],
      env: extraEnv(ctx),
    }),
    buildMcpConfig: claudeMcpConfig,
  };
}
