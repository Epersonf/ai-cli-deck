import type { ProviderInfo } from '@deck/shared';

const PREFERRED = ['claude', 'codex', 'shell'];

/**
 * Only profiles are offered: each has its own CLI config folder, hence its own login. The
 * built-in CLIs share the machine-wide login, so they are never a choice here.
 */
export const choices = (list: readonly ProviderInfo[], profileId: string | null): ProviderInfo[] =>
  list.filter((p) => (profileId === null ? p.profile : p.id === profileId));

export const pickDefault = (list: readonly ProviderInfo[]): string =>
  PREFERRED.map((id) => list.find((p) => p.id === id && p.status !== 'missing')).find(Boolean)
    ?.id ??
  list[0]?.id ??
  '';
