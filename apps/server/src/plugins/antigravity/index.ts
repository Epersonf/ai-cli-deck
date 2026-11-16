import { homedir } from 'node:os';
import { join } from 'node:path';
import type { PluginContext, PluginHooks } from '../../domain/providerPlugin.js';
import { antigravityDriver } from './engine/antigravityDriver.js';
import { antigravityModels } from './antigravityModels.js';
import { antigravityAuth } from './auth.js';
import { agentGuide } from '../../infrastructure/providers/agentGuide.js';

export default function create(ctx: PluginContext): PluginHooks {
  const binary = (): string =>
    ctx.resolve('agy') ??
    ctx.resolve(
      process.platform === 'win32'
        ? join(
            process.env['LOCALAPPDATA'] ?? join(homedir(), 'AppData', 'Local'),
            'agy',
            'bin',
            'agy.exe',
          )
        : join(homedir(), '.local', 'bin', 'agy'),
    ) ??
    'agy';
  return {
    installed: async () => binary() !== 'agy',
    install: async () => {
      const command =
        process.platform === 'win32'
          ? [
              'powershell.exe',
              '-NoProfile',
              '-ExecutionPolicy',
              'Bypass',
              '-Command',
              'irm https://antigravity.google/cli/install.ps1 | iex',
            ]
          : [
              'bash',
              '-c',
              'set -o pipefail; curl -fsSL https://antigravity.google/cli/install.sh | bash',
            ];
      const result = await ctx.run(command);
      return { ok: result.code === 0 && binary() !== 'agy', output: result.output };
    },
    login: () => ctx.startLogin([binary(), 'acp', '--login']),
    auth: (forLogin = false) =>
      antigravityAuth(binary(), forLogin ? ctx.loginEnv() : ctx.statusEnv()),
    logout: async () => {
      const result = await ctx.run([binary(), '-p', '/logout'], 15_000, 'login');
      if (result.code !== 0) throw new Error(result.output || 'Antigravity sign-out failed');
    },
    discoverModels: () => antigravityModels({ ...ctx.env(), DECK_ANTIGRAVITY_BIN: binary() }),
    driver: antigravityDriver,
    guide: agentGuide,
  };
}
