import type { ProviderInfo } from '@deck/shared';

const PREFERRED = ['claude', 'codex'];
const BUILTIN = new Set(PREFERRED);

/**
 * Claude Code and Codex with this machine's own login, and every profile (its own config folder, key
 * and endpoint). Opened from a profile, only that profile is offered.
 */
export const choices = (list: readonly ProviderInfo[], profileId: string | null): ProviderInfo[] =>
  list.filter((p) => (profileId === null ? p.profile || BUILTIN.has(p.id) : p.id === profileId));

export const pickDefault = (list: readonly ProviderInfo[]): string =>
  PREFERRED.map((id) => list.find((p) => p.id === id && p.status !== 'missing')).find(Boolean)
    ?.id ??
  list[0]?.id ??
  '';
