import type { Provider } from '../../domain/provider.js';
import type { ProviderDef } from '../config/schema.js';

/** Turns a config-file entry into a provider, so any AI CLI can be added without code. */
export function createConfiguredProvider(def: ProviderDef): Provider {
  return {
    id: def.id,
    label: def.label,
    buildCommand: (ctx) => ({
      command: def.command,
      args: [...def.args, ...ctx.args],
      env: { ...def.env },
    }),
    buildMcpConfig: (ctx) => ({
      args: def.mcpArgs.map((arg) => arg.replaceAll('{mcpUrl}', ctx.mcpUrl)),
      env: {},
    }),
  };
}
