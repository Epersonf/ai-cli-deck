import type { ProviderInfo, Session } from '@deck/shared';
import type { SessionGroup } from './groupSessions';
import { sessionLabel } from './sessionLabel';

/** Case-insensitive "contains"; an empty query matches everything. */
export function matchesText(text: string, query: string): boolean {
  const wanted = query.trim().toLowerCase();
  return wanted === '' || text.toLowerCase().includes(wanted);
}

export const filterGroups = (groups: readonly SessionGroup[], query: string): SessionGroup[] =>
  groups.filter((group) => matchesText(group.label, query));

/** Terminals whose displayed name matches (the folder is part of it for unnamed ones). */
export const filterSessions = (
  sessions: readonly Session[],
  providers: readonly ProviderInfo[],
  query: string,
): Session[] => sessions.filter((s) => matchesText(sessionLabel(s, providers), query));
