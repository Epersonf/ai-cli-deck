import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fakeQuery } from '../agents/fakeClaude.js';
import { claudeModels } from './claudeModels.js';
import { codexModels, configModel, parseCatalog } from './codexModels.js';
import { endpointModels, modelsUrl, type Fetcher } from './endpointModels.js';

describe('Claude models', () => {
  it('are what Claude Code says the account supports', async () => {
    const fake = fakeQuery();
    fake.api.supported = [
      { value: 'opus', displayName: 'Opus 5.5', description: 'Best' },
      { value: 'haiku' },
    ];
    const listing = await claudeModels(fake.queryFn, { ANTHROPIC_MODEL: 'opus' });
    expect(listing.choices).toEqual([
      { id: 'opus', label: 'Opus 5.5', description: 'Best' },
      { id: 'haiku', label: 'haiku', description: null },
    ]);
    expect(listing.current).toBe('opus');
  });
});

describe('Codex models', () => {
  const catalog = JSON.stringify({
    models: [
      { slug: 'a', display_name: 'A', description: 'fast', visibility: 'list' },
      { slug: 'b', visibility: 'hide' },
      { slug: 'c' },
    ],
  });

  it('skip the hidden ones, and the default is the config line before any table', () => {
    expect(parseCatalog(catalog).map((m) => m.id)).toEqual(['a', 'c']);
    expect(configModel('model = "gpt-9"\n[tui]\nmodel = "no"')).toBe('gpt-9');
    expect(configModel('[tui]\nmodel = "no"')).toBeNull();
  });

  it('come from the CLI, else from its cache file; the default from config.toml', async () => {
    const home = mkdtempSync(join(tmpdir(), 'codex-'));
    writeFileSync(join(home, 'models_cache.json'), catalog);
    writeFileSync(join(home, 'config.toml'), 'model = "c"\n');
    const viaCli = await codexModels({ CODEX_HOME: home }, () => Promise.resolve(catalog));
    expect(viaCli.choices.map((m) => m.id)).toEqual(['a', 'c']);
    const viaCache = await codexModels({ CODEX_HOME: home }, () => Promise.reject(new Error('x')));
    expect(viaCache).toMatchObject({ current: 'c' });
    expect(viaCache.choices).toHaveLength(2);
    const none = await codexModels({ CODEX_HOME: join(home, 'nothing') }, () =>
      Promise.reject(new Error('x')),
    );
    expect(none).toEqual({ choices: [], current: null });
  });
});

describe('endpoint models', () => {
  const env = {
    ANTHROPIC_BASE_URL: 'https://h/anthropic/',
    ANTHROPIC_AUTH_TOKEN: 'k',
    ANTHROPIC_MODEL: 'm1',
  };

  it('are listed by the endpoint with the saved key', async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const fetcher: Fetcher = (url, init) => {
      calls.push({ url, headers: init.headers });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'x' }, { id: 'y', display_name: 'Y' }] }),
      });
    };
    const listing = await endpointModels(env, fetcher);
    expect(listing.choices.map((m) => [m.id, m.label])).toEqual([
      ['x', 'x'],
      ['y', 'Y'],
    ]);
    expect(calls[0]?.url).toBe('https://h/anthropic/v1/models');
    expect(calls[0]?.headers['x-api-key']).toBe('k');
    expect(modelsUrl('https://h/v1')).toBe('https://h/v1/models');
  });

  it('fall back to the profile model, else to nothing, when the endpoint cannot say', async () => {
    const bad: Fetcher = () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    const boom: Fetcher = () => Promise.reject(new Error('down'));
    expect((await endpointModels(env, bad)).choices.map((m) => m.id)).toEqual(['m1']);
    expect((await endpointModels(env, boom)).current).toBe('m1');
    expect(await endpointModels({ ANTHROPIC_BASE_URL: 'https://h' }, boom)).toEqual({
      choices: [],
      current: null,
    });
  });
});
