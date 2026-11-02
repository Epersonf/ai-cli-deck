import { describe, expect, it } from 'vitest';
import { providerCtx } from '../../testing/providerContext.js';
import { createConfiguredProvider } from './configured.js';
import { createProviderRegistry } from './registry.js';

const ctx = providerCtx;

describe('configured providers', () => {
  it('builds any CLI from a config entry and substitutes the MCP url', () => {
    const gemini = createConfiguredProvider({
      id: 'gemini',
      label: 'Gemini CLI',
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
    const extra = createConfiguredProvider({
      id: 'claude',
      label: 'My Claude',
      command: 'c',
      args: [],
      env: {},
      mcpArgs: [],
    });
    const registry = createProviderRegistry(undefined, [extra]);
    expect(registry.get('claude')?.label).toBe('My Claude');
    expect(registry.list().map((p) => p.id)).toContain('shell');
  });
});
