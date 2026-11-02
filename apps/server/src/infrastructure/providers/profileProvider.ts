import { join } from 'node:path';
import type { Profile } from '@deck/shared';
import type { Provider } from '../../domain/provider.js';
import { claude } from './claude.js';
import { claudeDeepseek, DEEPSEEK_ENV } from './claudeDeepseek.js';
import { codex } from './codex.js';
import { shell } from './shell.js';

/** Env var each official CLI reads to find its own config/login folder. */
const HOME_VAR = {
  claude: 'CLAUDE_CONFIG_DIR',
  'claude-deepseek': 'CLAUDE_CONFIG_DIR',
  codex: 'CODEX_HOME',
} as const;
const BASE = { claude, 'claude-deepseek': claudeDeepseek, codex } as const;

/**
 * A profile is the CLI started clean: its own empty config folder, so no login or key from
 * anywhere else is linked. Signing in (or exporting a key) is done by the user in the terminal.
 */
export function createProfileProvider(profile: Profile, profilesDir: string): Provider {
  const home = join(profilesDir, profile.id);
  if (profile.base === 'custom') {
    return {
      id: profile.id,
      label: profile.label,
      buildCommand: (ctx) => ({
        command: profile.command || ctx.defaultShell,
        args: [...ctx.args],
        env: {},
      }),
      buildMcpConfig: shell.buildMcpConfig,
    };
  }
  const kind = profile.base;
  const base = BASE[kind];
  return {
    id: profile.id,
    label: profile.label,
    buildCommand: (ctx) => {
      const parts = base.buildCommand(ctx);
      const env = kind === 'claude-deepseek' ? { ...DEEPSEEK_ENV } : {};
      return { ...parts, env: { ...parts.env, ...env, [HOME_VAR[kind]]: home } };
    },
    buildMcpConfig: base.buildMcpConfig,
  };
}
