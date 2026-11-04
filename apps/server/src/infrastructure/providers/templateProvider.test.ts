import { join } from 'node:path';
import type { Profile } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { providerCtx as ctx } from '../../testing/providerContext.js';
import { BUILTIN_TEMPLATES } from './builtinTemplates.js';
import { createTemplateProvider } from './templateProvider.js';

const home = join('/cfg/profiles', 'p1'); // the platform's own separator
const make = (base: string, values: Record<string, string> = {}) => {
  const template = BUILTIN_TEMPLATES.find((t) => t.id === base);
  if (!template) throw new Error(base);
  const profile: Profile = { id: 'p1', label: 'P', base, values };
  return createTemplateProvider(profile, template, '/cfg/profiles');
};

describe('template providers (clean terminals)', () => {
  it('starts Claude Code with its own empty config folder and nothing else linked', () => {
    expect(make('claude').buildCommand({ ...ctx, args: ['-x'] })).toEqual({
      command: 'claude',
      args: ['-x'],
      env: { CLAUDE_CONFIG_DIR: home },
    });
  });

  it('points the deepseek template at DeepSeek, never injects a key, and asks for it on start', () => {
    const parts = make('claude-deepseek').buildCommand({ ...ctx, args: ['-x'] });
    expect(parts.env['ANTHROPIC_BASE_URL']).toContain('deepseek');
    expect(parts.env['CLAUDE_CONFIG_DIR']).toBe(home);
    expect(Object.keys(parts.env).some((k) => /KEY|TOKEN/.test(k))).toBe(false);
    expect(parts.command).toBe('clideck');
    expect(parts.args).toEqual([
      'ensure-key',
      'ANTHROPIC_AUTH_TOKEN',
      'DeepSeek API key',
      '--save',
      home,
      '--',
      'claude',
      '-x',
    ]);
  });

  it('a custom endpoint profile talks to its own URL and asks for its own key', () => {
    const url = 'https://llm.example.com/anthropic';
    const parts = make('claude-endpoint', { baseUrl: url }).buildCommand({ ...ctx, args: ['-x'] });
    expect(parts.command).toBe('clideck');
    expect(parts.args).toEqual([
      'ensure-key',
      'ANTHROPIC_AUTH_TOKEN',
      'API key for llm.example.com',
      '--save',
      home,
      '--',
      'claude',
      '-x',
    ]);
    expect(parts.env).toEqual({ ANTHROPIC_BASE_URL: url, CLAUDE_CONFIG_DIR: home });
  });

  it('uses CODEX_HOME for codex and hands every AI template the deck briefing', () => {
    expect(make('codex').buildCommand(ctx).env).toEqual({ CODEX_HOME: home });
    expect(make('claude').buildMcpConfig(ctx).args).toContain('--append-system-prompt');
    const codexArgs = make('codex').buildMcpConfig(ctx).args;
    expect(codexArgs[1]).toBe(`mcp_servers.deck.url=${JSON.stringify(ctx.mcpUrl)}`);
    expect(codexArgs[3]).toContain('developer_instructions="');
  });

  it('custom runs the given program, or the default shell when empty, with no deck wiring', () => {
    expect(make('custom', { command: 'aider' }).buildCommand(ctx).command).toBe('aider');
    expect(make('custom').buildCommand(ctx).command).toBe('bash');
    expect(make('custom').buildMcpConfig(ctx).args).toEqual([]);
  });
});
