import { join } from 'node:path';
import { invalid } from '../../domain/errors.js';
import type { Provider } from '../../domain/provider.js';
import type { ProviderDef } from '../config/schema.js';
import { claude } from './claude.js';
import { codex } from './codex.js';

type Env = Readonly<Record<string, string | undefined>>;

export interface ConfiguredDeps {
  /** Host environment, used for `envFromHost`. */
  env: Env;
  /** Where isolated profile folders live (one subfolder per provider id). */
  profilesDir: string;
}

const BASES = { claude, codex } as const;
/** Env var each official CLI reads to find its own config/login folder. */
const HOME_VAR = { claude: 'CLAUDE_CONFIG_DIR', codex: 'CODEX_HOME' } as const;

/** The executable a config entry launches (used for the installed/missing check). */
export const commandOf = (def: ProviderDef): string =>
  def.base === null ? def.command : def.command || def.base;

function hostEnv(def: ProviderDef, env: Env): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, source] of Object.entries(def.envFromHost)) {
    const value = env[source];
    if (!value) throw invalid(`Set ${source} in the environment to use "${def.label}"`);
    out[name] = value;
  }
  return out;
}

/**
 * Turns a config entry into a provider. With `base`, it is the official CLI run with its own
 * config folder (so its own login) and optional API key; the deck never handles credentials.
 */
export function createConfiguredProvider(def: ProviderDef, deps: ConfiguredDeps): Provider {
  const base = def.base === null ? null : BASES[def.base];
  return {
    id: def.id,
    label: def.label,
    buildCommand: (ctx) => {
      const profile =
        def.base === null
          ? {}
          : { [HOME_VAR[def.base]]: def.configDir ?? join(deps.profilesDir, def.id) };
      const inherited = base?.buildCommand(ctx);
      return {
        command: def.command || inherited?.command || def.command,
        args: [...def.args, ...(inherited ? [] : ctx.args), ...(inherited?.args ?? [])],
        env: { ...inherited?.env, ...profile, ...def.env, ...hostEnv(def, deps.env) },
      };
    },
    buildMcpConfig: (ctx) => {
      const own = def.mcpArgs.map((arg) => arg.replaceAll('{mcpUrl}', ctx.mcpUrl));
      return base && own.length === 0 ? base.buildMcpConfig(ctx) : { args: own, env: {} };
    },
  };
}
