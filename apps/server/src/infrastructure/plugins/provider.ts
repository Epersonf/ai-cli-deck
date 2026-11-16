import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Profile } from '@deck/shared';
import type { Provider } from '../../domain/provider.js';
import type { PluginRuntime } from '../../domain/providerPlugin.js';
import { pluginContext } from './context.js';

/** Apply the package's lifecycle to a profile or a machine-login built-in. */
export function withPlugin(
  provider: Provider,
  profile: Profile,
  home: string,
  plugin: PluginRuntime,
): Provider {
  const marker = join(home, '.deck-login');
  const login = provider.login ?? {
    env: () => ({}),
    own: () => existsSync(marker),
    setOwn: (on: boolean) => {
      if (on) {
        mkdirSync(home, { recursive: true });
        writeFileSync(marker, 'signed in from the deck');
      } else rmSync(marker, { force: true });
    },
  };
  const base = { ...provider, login };
  const hooks = plugin.create(pluginContext(profile, home, base));
  for (const method of ['installed', 'install', 'login', 'auth', 'logout'] as const)
    if (typeof hooks[method] !== 'function')
      throw new Error(`Plugin ${profile.base} is missing ${method}`);
  if (!hooks.driver || typeof hooks.driver.start !== 'function')
    throw new Error(`Plugin ${profile.base} is missing its execution driver`);
  return {
    ...base,
    features: plugin.manifest.features,
    setup: hooks,
    get chat() {
      return hooks.chat?.() ?? provider.chat ?? null;
    },
    ...(hooks.history ? { history: hooks.history } : {}),
    compactTools: hooks.compactTools ?? false,
    authentication: {
      methods: plugin.manifest.authMethods.filter(
        (method) => provider.signIn !== 'key' || method.flow === 'key',
      ),
      login: hooks.login,
      status: hooks.auth,
      logout: hooks.logout,
    },
    ...(hooks.driver ? { driver: hooks.driver } : {}),
    ...(hooks.guide ? { guide: hooks.guide } : {}),
    ...(hooks.discoverModels ? { discoverModels: hooks.discoverModels } : {}),
    ...(hooks.discoverLimits ? { discoverLimits: hooks.discoverLimits } : {}),
  };
}
