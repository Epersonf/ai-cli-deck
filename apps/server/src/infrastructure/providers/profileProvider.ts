import { join } from 'node:path';
import type { Profile } from '@deck/shared';
import type { Provider } from '../../domain/provider.js';
import { claude } from './claude.js';
import { claudeDeepseek, deepseekParts } from './claudeDeepseek.js';
import { claudeEndpointParts } from './claudeEndpoint.js';
import { codex } from './codex.js';
import { shell } from './shell.js';

/** Env var each official CLI reads to find its own config/login folder. */
const HOME_VAR = {
  claude: 'CLAUDE_CONFIG_DIR',
  'claude-endpoint': 'CLAUDE_CONFIG_DIR',
  'claude-deepseek': 'CLAUDE_CONFIG_DIR',
  codex: 'CODEX_HOME',
} as const;
const BASE = {
  claude,
  'claude-endpoint': claude, // shares claude's MCP wiring; the command is built below
  'claude-deepseek': claudeDeepseek,
  codex,
} as const;

const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/**
 * A profile is the CLI started clean: its own empty config folder, so no login or key from
 * anywhere else is linked. Signing in (or typing a key when asked) is done by the user in the terminal.
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
      // Endpoint bases ask for their key on first start and remember it in this profile's own config folder.
      const parts =
        kind === 'claude-deepseek'
          ? deepseekParts(ctx, home)
          : kind === 'claude-endpoint'
            ? claudeEndpointParts(ctx, {
                baseUrl: profile.baseUrl,
                keyLabel: `API key for ${hostOf(profile.baseUrl)}`,
                saveDir: home,
              })
            : base.buildCommand(ctx);
      return { ...parts, env: { ...parts.env, [HOME_VAR[kind]]: home } };
    },
    buildMcpConfig: base.buildMcpConfig,
  };
}
