import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createProfileService } from '../providers/profileWiring.js';
import { createProviderRegistry } from '../providers/registry.js';
import { ProviderStatusResolver, realStatusDeps } from '../providers/status.js';
import { SETUP_SPECS } from '@deck/shared';
import { providerCtx } from '../../testing/providerContext.js';

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
describe('profiles using complete plugins', () => {
  it('migrates every built-in base while preserving private keys and Codex policies', async () => {
    const configDir = await mkdtemp(join(tmpdir(), 'deck-plugin-profiles-'));
    dirs.push(configDir);
    const providers = createProviderRegistry();
    const service = await createProfileService({
      configDir,
      providers,
      status: new ProviderStatusResolver(SETUP_SPECS, realStatusDeps()),
    });
    expect(
      service.templates
        .list()
        .filter((template) => template.plugin)
        .map((template) => template.id),
    ).toEqual(['claude', 'claude-endpoint', 'claude-deepseek', 'codex', 'antigravity']);
    for (const base of ['claude', 'claude-endpoint', 'claude-deepseek', 'codex', 'antigravity']) {
      const profile = await service.profiles.create({
        base,
        label: `Test ${base}`,
        values: base === 'claude-endpoint' ? { baseUrl: 'https://example.com/anthropic' } : {},
        secret: 'private-test-key',
      });
      const provider = providers.get(profile.id);
      expect(provider?.driver?.start).toBeTypeOf('function');
      expect(provider?.setup?.install).toBeTypeOf('function');
      expect(provider?.authentication?.methods.length).toBeGreaterThan(0);
      expect(provider?.keyState?.()).toBe('set');
      if (base === 'antigravity')
        expect(provider?.buildAgent(providerCtx).env['GEMINI_API_KEY']).toBe('private-test-key');
      if (base === 'codex') {
        expect(provider?.features?.cacheIdleRiskMs).toBe(3600000);
        expect(provider?.compactTools).toBe(true);
        expect(provider?.guide?.({ phone: false, devices: [] })).toContain(
          'Keep tool output focused',
        );
      }
    }
  });
});
