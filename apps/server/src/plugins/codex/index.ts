import { homedir } from 'node:os';
import { join } from 'node:path';
import { codexChats } from './chats.js';
import type { PluginContext, PluginHooks } from '../../domain/providerPlugin.js';
import { codexDriver } from './engine/codexDriver.js';
import { resolveCodex } from './engine/codexBin.js';
import { codexLimits } from './engine/codexLimits.js';
import { codexModels } from './codexModels.js';
import { codexGuide } from './codexGuide.js';
import { codexAuthStatus } from './auth.js';

/** Includes native fork/compaction, stable briefings, output budgets and rollout usage. */
export default function create(ctx: PluginContext): PluginHooks {
  const command = (): string[] => {
    const bin = resolveCodex(ctx.loginEnv());
    return [bin.command, ...bin.prefix];
  };
  return {
    history: codexChats,
    chat: () => ({ format: 'codex', home: ctx.env()['CODEX_HOME'] ?? join(homedir(), '.codex') }),
    installed: async () => ctx.resolve('codex') !== null || command()[0] !== 'codex',
    install: async () => {
      const result = await ctx.run(['npm', 'install', '-g', '@openai/codex']);
      return { ok: result.code === 0, output: result.output };
    },
    login: () => ctx.startLogin([...command(), 'login', '--device-auth']),
    auth: async (forLogin = false) =>
      codexAuthStatus(
        await ctx.run([...command(), 'login', 'status'], 8000, forLogin ? 'login' : 'status'),
        false,
      ),
    logout: async () => {
      const result = await ctx.run([...command(), 'logout'], 8000, 'login');
      if (result.code !== 0) throw new Error(result.output || 'Codex sign-out failed');
    },
    discoverModels: () => codexModels(ctx.env()),
    discoverLimits: () => codexLimits(ctx.env()),
    driver: codexDriver,
    compactTools: true,
    guide: codexGuide,
  };
}
