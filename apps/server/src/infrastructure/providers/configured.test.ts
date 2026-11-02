import { describe, expect, it } from 'vitest';
import { providerCtx as ctx } from '../../testing/providerContext.js';
import { ProviderDefSchema } from '../config/schema.js';
import { commandOf, createConfiguredProvider } from './configured.js';
import { createProviderRegistry } from './registry.js';

const deps = { env: { WORK_KEY: 'sk-work' }, profilesDir: '/cfg/profiles' };
const make = (input: Record<string, unknown>) =>
  createConfiguredProvider(ProviderDefSchema.parse({ label: 'X', ...input }), deps);

describe('configured providers', () => {
  it('builds any CLI from a config entry and substitutes the MCP url', () => {
    const gemini = make({
      id: 'gemini',
      command: 'gemini',
      args: ['--yolo'],
      env: { FOO: 'bar' },
      mcpArgs: ['--mcp', '{mcpUrl}'],
    });
    const parts = gemini.buildCommand({ ...ctx, args: ['-x'] });
    expect(parts).toEqual({ command: 'gemini', args: ['--yolo', '-x'], env: { FOO: 'bar' } });
    expect(gemini.buildMcpConfig(ctx).args).toEqual(['--mcp', ctx.mcpUrl]);
  });

  it('lets configured providers add and override registry entries', () => {
    const registry = createProviderRegistry(undefined, [make({ id: 'claude', command: 'c' })]);
    expect(registry.get('claude')?.label).toBe('X');
    expect(registry.list().map((p) => p.id)).toContain('shell');
  });
});

describe('profiles of an official CLI', () => {
  it('runs claude with a private config folder and a host-provided key', () => {
    const work = make({
      id: 'claude-work',
      base: 'claude',
      envFromHost: { ANTHROPIC_API_KEY: 'WORK_KEY' },
    });
    const parts = work.buildCommand({ ...ctx, args: ['-x'] });
    expect(parts.command).toBe('claude');
    expect(parts.args).toEqual(['-x']);
    expect(parts.env).toEqual({
      CLAUDE_CONFIG_DIR: '/cfg/profiles/claude-work',
      ANTHROPIC_API_KEY: 'sk-work',
    });
    expect(work.buildMcpConfig(ctx).args[0]).toBe('--mcp-config');
  });

  it('keeps two profiles of the same CLI apart', () => {
    const a = make({ id: 'a', base: 'claude' }).buildCommand(ctx).env;
    const b = make({ id: 'b', base: 'claude', configDir: '/custom' }).buildCommand(ctx).env;
    expect(a['CLAUDE_CONFIG_DIR']).toBe('/cfg/profiles/a');
    expect(b['CLAUDE_CONFIG_DIR']).toBe('/custom');
  });

  it('uses CODEX_HOME for codex profiles', () => {
    const env = make({ id: 'cx', base: 'codex' }).buildCommand(ctx).env;
    expect(env['CODEX_HOME']).toBe('/cfg/profiles/cx');
  });

  it('fails clearly when the host variable is missing, and needs base or command', () => {
    const p = make({ id: 'p', base: 'claude', envFromHost: { K: 'NOPE' } });
    expect(() => p.buildCommand(ctx)).toThrow(/NOPE/);
    expect(() => ProviderDefSchema.parse({ id: 'q', label: 'Q' })).toThrow();
    expect(commandOf(ProviderDefSchema.parse({ id: 'c', label: 'C', base: 'codex' }))).toBe(
      'codex',
    );
  });
});
