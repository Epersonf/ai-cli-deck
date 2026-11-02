import type { Session } from '@deck/shared';

/** Annotates each live session with the ids of other live sessions in the same folder. */
export function withSharedCwd(sessions: readonly Session[]): Session[] {
  return sessions.map((session) => ({
    ...session,
    sharedCwdWith:
      session.status === 'exited'
        ? []
        : sessions
            .filter((o) => o.id !== session.id && o.status !== 'exited' && o.cwd === session.cwd)
            .map((o) => o.id),
  }));
}
