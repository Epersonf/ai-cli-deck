import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Profile } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { providerCtx as ctx } from '../../testing/providerContext.js';
import { BUILTIN_TEMPLATES } from './builtinTemplates.js';
import { writeSecret } from './profileSecret.js';
import { createTemplateProvider } from './templateProvider.js';

async function make(base: string, values: Record<string, string> = {}, secret?: string) {
  const dir = await mkdtemp(join(tmpdir(), 'deck-prov-'));
  await mkdir(join(dir, 'p1'), { recursive: true });
  if (secret) await writeSecret(join(dir, 'p1'), secret);
  const template = BUILTIN_TEMPLATES.find((t) => t.id === base);
  if (!template) throw new Error(base);
  const profile: Profile = { id: 'p1', label: 'P', base, values };
  return { provider: createTemplateProvider(profile, template, dir), home: join(dir, 'p1'), dir };
}

describe('agent profiles from templates', () => {
  it('Claude with no key uses the machine login: no config folder of its own', async () => {
    const { provider } = await make('claude');
    expect(provider.agent).toBe('claude');
    expect(provider.buildAgent(ctx)).toEqual({ kind: 'claude', env: {}, model: null });
    expect(provider.keyState?.()).toBe('none');
  });

  it('Claude with a key gets its own folder, and a Claude Code token has its own variable', async () => {
    const own = await make('claude', {}, 'sk-ant-api03-x');
    expect(own.provider.buildAgent(ctx).env).toEqual({
      CLAUDE_CONFIG_DIR: own.home,
      ANTHROPIC_API_KEY: 'sk-ant-api03-x',
    });
    const token = await make('claude', {}, 'sk-ant-oat01-y');
    expect(token.provider.buildAgent(ctx).env).toEqual({
      CLAUDE_CONFIG_DIR: token.home,
      CLAUDE_CODE_OAUTH_TOKEN: 'sk-ant-oat01-y',
    });
    expect(token.provider.keyState?.()).toBe('set');
  });

  it('the custom provider talks to its own URL and needs its key; an empty model is left out', async () => {
    const url = 'https://llm.example.com/anthropic';
    const missing = await make('claude-endpoint', { baseUrl: url });
    expect(missing.provider.keyState?.()).toBe('missing');
    expect(missing.provider.buildAgent(ctx).env).toEqual({
      ANTHROPIC_BASE_URL: url,
      CLAUDE_CONFIG_DIR: missing.home,
    });
    const ready = await make('claude-endpoint', { baseUrl: url, model: 'm1' }, 'k-123');
    expect(ready.provider.buildAgent(ctx).env).toEqual({
      ANTHROPIC_BASE_URL: url,
      ANTHROPIC_MODEL: 'm1',
      CLAUDE_CONFIG_DIR: ready.home,
      ANTHROPIC_AUTH_TOKEN: 'k-123',
    });
    expect(ready.provider.keyState?.()).toBe('set');
  });

  it('DeepSeek is fixed to its API and asks it for its models', async () => {
    const { provider, home } = await make('claude-deepseek', {}, 'ds-key');
    const env = provider.buildAgent(ctx).env;
    expect(env['ANTHROPIC_BASE_URL']).toBe('https://api.deepseek.com/anthropic');
    expect(env['ANTHROPIC_AUTH_TOKEN']).toBe('ds-key');
    expect(env['CLAUDE_CONFIG_DIR']).toBe(home);
    expect(provider.discoverModels).toBeDefined();
  });

  it('still reads a key an older version saved in Claude settings', async () => {
    const { provider, home } = await make('claude-deepseek');
    expect(provider.keyState?.()).toBe('missing');
    await writeFile(
      join(home, 'settings.json'),
      JSON.stringify({ env: { ANTHROPIC_AUTH_TOKEN: 'old-key' } }),
    );
    expect(provider.keyState?.()).toBe('set');
  });

  it('Codex keeps its own CODEX_HOME once it has a key and chats are read from there', async () => {
    const none = await make('codex');
    expect(none.provider.agent).toBe('codex');
    expect(none.provider.buildAgent(ctx).env).toEqual({});
    const keyed = await make('codex', {}, 'sk-openai');
    expect(keyed.provider.buildAgent(ctx).env).toEqual({
      CODEX_HOME: keyed.home,
      OPENAI_API_KEY: 'sk-openai',
    });
    expect(keyed.provider.chat).toEqual({ format: 'codex', home: keyed.home });
  });
});
