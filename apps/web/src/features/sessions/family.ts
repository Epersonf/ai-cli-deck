import type { Session } from '@deck/shared';

/** The main session first, then its sub-terminals; null when the active session has none. */
export function familyOf(sessions: readonly Session[], activeId: string | null): Session[] | null {
  const active = sessions.find((s) => s.id === activeId);
  if (!active) return null;
  const rootId = active.parentId ?? active.id;
  const family = sessions.filter((s) => s.id === rootId || s.parentId === rootId);
  return family.length > 1 ? family : null;
}
