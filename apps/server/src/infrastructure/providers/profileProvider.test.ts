import { describe, expect, it } from 'vitest';
import { providerCtx as ctx } from '../../testing/providerContext.js';
import { createProfileProvider } from './profileProvider.js';

const make = (base: 'claude' | 'claude-deepseek' | 'codex' | 'custom', command = '') =>
  createProfileProvider({ id: 'p1', label: 'P', base, command }, '/cfg/profiles');

describe('profile providers (clean terminals)', () => {
  it('starts Claude Code with its own empty config folder and nothing else linked', () => {
    const parts = make('claude').buildCommand({ ...ctx, args: ['-x'] });
    expect(parts).toEqual({
      command: 'claude',
      args: ['-x'],
      env: { CLAUDE_CONFIG_DIR: '/cfg/profiles/p1' },
    });
  });

  it('points the deepseek base at DeepSeek but never injects a key', () => {
    const env = make('claude-deepseek').buildCommand(ctx).env;
    expect(env['ANTHROPIC_BASE_URL']).toContain('deepseek');
    expect(env['CLAUDE_CONFIG_DIR']).toBe('/cfg/profiles/p1');
    expect(Object.keys(env).some((k) => /KEY|TOKEN/.test(k))).toBe(false);
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
