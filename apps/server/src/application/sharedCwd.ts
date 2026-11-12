import type { Session } from '@deck/shared';

/** Annotates each session with the ids of other sessions in the same folder. */
export function withSharedCwd(sessions: readonly Session[]): Session[] {
  return sessions.map((session) => ({
    ...session,
    sharedCwdWith: sessions
      .filter((o) => o.id !== session.id && o.cwd === session.cwd)
      .map((o) => o.id),
  }));
}
