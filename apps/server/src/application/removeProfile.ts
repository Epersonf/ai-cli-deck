import type { ProfileService } from './ProfileService.js';
import type { SessionManager } from './SessionManager.js';

/**
 * Deleting a profile ends its terminals, then erases its CLI config folder (logins included).
 * It always goes through: a terminal that is stuck, already gone or fails to die must not keep
 * the profile alive, so each step is best-effort and only the count of ended terminals is reported.
 */
export async function removeProfile(
  deps: { profiles: ProfileService; sessions: SessionManager },
  id: string,
): Promise<{ ended: number }> {
  const owned = deps.sessions.list().filter((s) => s.provider === id);
  await deps.profiles.remove(id);
  let ended = 0;
  for (const session of owned) {
    try {
      await deps.sessions.remove(session.id);
      ended += 1;
    } catch {
      // keep going: the remaining terminals and the profile data still have to be cleaned up
    }
  }
  await deps.profiles.purgeData(id).catch(() => undefined);
  return { ended };
}
