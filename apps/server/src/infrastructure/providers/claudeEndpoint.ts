import type { CommandParts, ProviderContext } from '../../domain/provider.js';

/** Claude Code reads a gateway's key from this variable; without it, it asks for an Anthropic login. */
export const ENDPOINT_KEY_ENV = 'ANTHROPIC_AUTH_TOKEN';

export interface EndpointSpec {
  /** Where Claude Code sends its requests (`ANTHROPIC_BASE_URL`). */
  baseUrl: string;
  /** Extra variables, e.g. the model names a vendor needs. */
  env?: Readonly<Record<string, string>>;
  /** Shown when the key is asked for, e.g. "DeepSeek API key". */
  keyLabel: string;
  /** The profile's own Claude config folder, where the key is remembered; null = ask every start. */
  saveDir: string | null;
}

/**
 * Claude Code against any Anthropic-compatible API (a vendor, or a company gateway with its own keys),
 * started through `clideck ensure-key`: the terminal asks for the key (hidden) when there is none, then
 * runs `claude`. With `saveDir` the key is kept in that folder's own Claude settings, so it is asked once.
 * The deck stores no key of its own, and every profile has its own folder, hence its own key.
 */
export function claudeEndpointParts(ctx: ProviderContext, spec: EndpointSpec): CommandParts {
  const save = spec.saveDir === null ? [] : ['--save', spec.saveDir];
  return {
    command: 'clideck',
    args: ['ensure-key', ENDPOINT_KEY_ENV, spec.keyLabel, ...save, '--', 'claude', ...ctx.args],
    env: { ...spec.env, ANTHROPIC_BASE_URL: spec.baseUrl },
  };
}
