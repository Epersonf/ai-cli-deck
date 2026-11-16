import { describe, expect, it } from 'vitest';
import { ProviderInfoSchema } from '@deck/shared';
import { ProviderPlugins } from './registry.js';
import type { PluginContext } from '../../domain/providerPlugin.js';
import { FakeChild } from '../../testing/fakeLoginChild.js';

function context(): PluginContext {
  return {
    profile: { id: 'test', label: 'Test', base: 'test', values: {} },
    home: '/tmp/plugin-test',
    env: () => ({}),
    loginEnv: () => ({}),
    statusEnv: () => ({}),
    resolve: () => null,
    run: () => Promise.resolve({ code: 0, output: '' }),
    startLogin: () => new FakeChild(),
  };
}

describe('provider plugin contract', () => {
  it('discovers all bundled plugins and their complete lifecycle without running a model', async () => {
    const plugins = new ProviderPlugins('/tmp/no-deck-plugins');
    await plugins.load();
    expect(plugins.list().map((plugin) => plugin.id)).toEqual([
      'claude',
      'claude-endpoint',
      'claude-deepseek',
      'codex',
      'antigravity',
    ]);
    for (const info of plugins.list()) {
      const runtime = plugins.get(info.id);
      if (!runtime) throw new Error('Missing runtime');
      const hooks = runtime.create(context());
      for (const method of [
        'installed',
        'install',
        'login',
        'auth',
        'logout',
        'discoverModels',
      ] as const)
        expect(typeof hooks[method]).toBe('function');
      expect(typeof hooks.driver?.start).toBe('function');
      expect(runtime.manifest.tests.length).toBeGreaterThan(0);
      expect(
        ProviderInfoSchema.parse({
          id: info.id,
          label: info.label,
          agent: info.agent,
          authMethods: runtime.manifest.authMethods,
          status: 'ready',
          hint: null,
          canInstall: false,
        }).agent,
      ).toBe(info.agent);
    }
  });
});
