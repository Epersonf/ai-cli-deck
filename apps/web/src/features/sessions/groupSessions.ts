import type { ProviderInfo, Session } from '@deck/shared';

export interface SessionGroup {
  id: string;
  label: string;
  /** True for profiles made by the user: they can be renamed and deleted. */
  profile: boolean;
  sessions: Session[];
}

/**
 * One group per profile, in creation order. Built-in CLIs only appear while they have terminals;
 * a profile you made always appears, even when empty, so you can add a terminal to it.
 */
export function groupSessions(
  providers: readonly ProviderInfo[],
  sessions: readonly Session[],
): SessionGroup[] {
  // Sub-terminals live in the tabs of their main session, not in the profile lists.
  const main = sessions.filter((s) => s.parentId === null);
  const known = new Set(providers.map((p) => p.id));
  const groups: SessionGroup[] = providers.map((p) => ({
    id: p.id,
    label: p.label,
    profile: p.profile,
    sessions: main.filter((s) => s.provider === p.id),
  }));
  const orphans = [...new Set(main.map((s) => s.provider))]
    .filter((id) => !known.has(id))
    .map((id) => ({
      id,
      label: id,
      profile: false,
      sessions: main.filter((s) => s.provider === id),
    }));
  return [...groups, ...orphans]
    .filter((g) => g.profile || g.sessions.length > 0)
    .sort((a, b) => Number(b.profile) - Number(a.profile));
}
