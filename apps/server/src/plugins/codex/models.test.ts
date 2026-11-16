import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { codexModels, configModel, parseCatalog } from './codexModels.js';

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
