import { homedir } from 'node:os';
import { join } from 'node:path';
import { claudeChats } from './chats.js';
import type { PluginContext, PluginHooks } from '../../domain/providerPlugin.js';
import { createClaudeDriver } from './engine/claudeDriver.js';
import { sdkQuery } from './engine/claudeQuery.js';
import { claudeModels } from './claudeModels.js';
import { claudeLimits } from './claudeLimits.js';
import { endpointModels } from './endpointModels.js';
import { claudeCommand } from './binary.js';
import { claudeAuthStatus } from './auth.js';
import { agentGuide } from '../../infrastructure/providers/agentGuide.js';

/** Claude's SDK, sign-in, catalog and usage all belong to this plugin. */
export default function create(ctx: PluginContext): PluginHooks {
  const binary = (): string => claudeCommand(ctx.loginEnv());
  return {
    history: claudeChats,
    chat: () => ({
      format: 'claude',
      home: ctx.env()['CLAUDE_CONFIG_DIR'] ?? join(homedir(), '.claude'),
    }),
    installed: async () => ctx.resolve(binary()) !== null,
    install: async () => {
      const result = await ctx.run(['npm', 'install', '-g', '@anthropic-ai/claude-code']);
      return { ok: result.code === 0, output: result.output };
    },
    login: (method) =>
      ctx.startLogin([
        binary(),
        'auth',
        'login',
        method === 'claude-console' ? '--console' : '--claudeai',
      ]),
    auth: async (forLogin = false) =>
      claudeAuthStatus(
        await ctx.run([binary(), 'auth', 'status'], 8000, forLogin ? 'login' : 'status'),
        false,
      ),
    logout: async () => {
      const result = await ctx.run([binary(), 'auth', 'logout'], 8000, 'login');
      if (result.code !== 0) throw new Error(result.output || 'Claude sign-out failed');
    },
    discoverModels: () =>
      ctx.env()['ANTHROPIC_BASE_URL']
        ? endpointModels(ctx.env())
        : claudeModels(sdkQuery, ctx.env()),
    discoverLimits: () =>
      ctx.env()['ANTHROPIC_BASE_URL'] ? Promise.resolve([]) : claudeLimits(sdkQuery, ctx.env()),
    driver: createClaudeDriver(sdkQuery),
    guide: agentGuide,
  };
}
