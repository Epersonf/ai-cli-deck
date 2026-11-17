import { homedir } from 'node:os';
import { join } from 'node:path';
import type { PluginContext, PluginHooks } from '../../domain/providerPlugin.js';
import { grokDriver } from './engine/grokDriver.js';
import { grokModels } from './grokModels.js';
import { grokAuth } from './auth.js';
import { agentGuide } from '../../infrastructure/providers/agentGuide.js';

/** xAI's official Grok Build CLI, driven over ACP (`grok agent stdio`). */
export default function create(ctx: PluginContext): PluginHooks {
  const binary = (): string =>
    ctx.resolve('grok') ??
    ctx.resolve(
      join(homedir(), '.grok', 'bin', process.platform === 'win32' ? 'grok.exe' : 'grok'),
    ) ??
    'grok';
  return {
    installed: async () => binary() !== 'grok',
    install: async () => {
      const result = await ctx.run(['npm', 'install', '-g', '@xai-official/grok']);
      return { ok: result.code === 0 && binary() !== 'grok', output: result.output };
    },
    login: () => ctx.startLogin([binary(), 'login', '--device-auth']),
    auth: (forLogin = false) => grokAuth(binary(), forLogin ? ctx.loginEnv() : ctx.statusEnv()),
    logout: async () => {
      const result = await ctx.run([binary(), 'logout'], 15_000, 'login');
      if (result.code !== 0) throw new Error(result.output || 'Grok sign-out failed');
    },
    discoverModels: () => grokModels({ ...ctx.env(), DECK_GROK_BIN: binary() }),
    driver: grokDriver,
    guide: agentGuide,
  };
}
