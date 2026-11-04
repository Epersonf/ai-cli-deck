import type { ProviderInfo } from '@deck/shared';

/** Profiles that can host the new terminal (plus the current one, which may be a built-in CLI). */
export const forkChoices = (list: readonly ProviderInfo[], current: string): ProviderInfo[] =>
  list.filter((p) => (p.profile || p.id === current) && p.status !== 'missing');
