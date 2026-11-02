import { describe, expect, it } from 'vitest';
import { providerCtx as ctx } from '../../testing/providerContext.js';
import { ProviderDefSchema } from '../config/schema.js';
import { createConfiguredProvider } from './configured.js';
import { createProviderRegistry } from './registry.js';

const make = (input: Record<string, unknown>) =>
  createConfiguredProvider(ProviderDefSchema.parse({ label: 'X', ...input }));

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
