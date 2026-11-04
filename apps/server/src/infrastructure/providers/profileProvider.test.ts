import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { providerCtx as ctx } from '../../testing/providerContext.js';
import { createProfileProvider } from './profileProvider.js';

const make = (
  base: 'claude' | 'claude-endpoint' | 'claude-deepseek' | 'codex' | 'custom',
  command = '',
  baseUrl = '',
) => createProfileProvider({ id: 'p1', label: 'P', base, command, baseUrl }, '/cfg/profiles');

describe('profile providers (clean terminals)', () => {
  it('starts Claude Code with its own empty config folder and nothing else linked', () => {
    const parts = make('claude').buildCommand({ ...ctx, args: ['-x'] });
    expect(parts).toEqual({
      command: 'claude',
      args: ['-x'],
      env: { CLAUDE_CONFIG_DIR: '/cfg/profiles/p1' },
    });
  });

  it('points the deepseek base at DeepSeek, never injects a key, and asks for it on start', () => {
    const parts = make('claude-deepseek').buildCommand({ ...ctx, args: ['-x'] });
    expect(parts.env['ANTHROPIC_BASE_URL']).toContain('deepseek');
    const home = join('/cfg/profiles', 'p1'); // the platform's own separator
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
    const home = join('/cfg/profiles', 'p1');
    const parts = make('claude-endpoint', '', url).buildCommand({ ...ctx, args: ['-x'] });
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

  it('uses CODEX_HOME for codex and the deck briefing for every AI base', () => {
    expect(make('codex').buildCommand(ctx).env).toEqual({ CODEX_HOME: '/cfg/profiles/p1' });
    expect(make('claude').buildMcpConfig(ctx).args).toContain('--append-system-prompt');
  });

  it('custom runs the given program, or the default shell when empty', () => {
    expect(make('custom', 'aider').buildCommand(ctx).command).toBe('aider');
    expect(make('custom').buildCommand(ctx).command).toBe('bash');
  });
});
