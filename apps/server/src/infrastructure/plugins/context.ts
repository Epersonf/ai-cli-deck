import { existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import type { Profile } from '@deck/shared';
import type { Provider } from '../../domain/provider.js';
import type { PluginContext } from '../../domain/providerPlugin.js';
import { stringEnv } from '../config/stringEnv.js';
import { locate } from '../voice/locate.js';
import { runPluginCommand, startPluginLogin } from './process.js';

/** Profile keys enter agent processes, not installer commands. */
export function pluginContext(profile: Profile, home: string, provider: Provider): PluginContext {
  const base = stringEnv();
  const context = { sessionId: '', cwd: home, port: 0, mcpUrl: '', guide: '' };
  const agentEnv = (): Record<string, string> => ({ ...base, ...provider.buildAgent(context).env });
  const loginEnv = (): Record<string, string> => ({ ...base, ...(provider.login?.env() ?? {}) });
  const statusEnv = (): Record<string, string> => (provider.login?.own() ? loginEnv() : base);
  return {
    profile,
    home,
    env: agentEnv,
    loginEnv,
    statusEnv,
    resolve: (binary) => {
      if (isAbsolute(binary)) return existsSync(binary) ? binary : null;
      return (
        locate([binary], base) ??
        (process.platform === 'win32' ? locate([`${binary}.cmd`], base, 'linux') : null)
      );
    },
    run: (argv, timeout, environment = 'system') =>
      runPluginCommand(
        argv,
        environment === 'profile'
          ? agentEnv()
          : environment === 'login'
            ? loginEnv()
            : environment === 'status'
              ? statusEnv()
              : base,
        timeout,
      ),
    startLogin: (argv) =>
      startPluginLogin(argv, {
        ...loginEnv(),
        ...(process.platform === 'win32' ? {} : { BROWSER: 'true' }),
      }),
  };
}
