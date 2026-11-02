import type { ProfileService } from './ProfileService.js';
import type { SessionManager } from './SessionManager.js';

/** Deleting a profile ends its terminals, then erases its CLI config folder (logins included). */
export async function removeProfile(
  deps: { profiles: ProfileService; sessions: SessionManager },
  id: string,
): Promise<{ ended: number }> {
  const owned = deps.sessions.list().filter((s) => s.provider === id);
  await deps.profiles.remove(id);
  for (const session of owned) await deps.sessions.remove(session.id);
  await deps.profiles.purgeData(id);
  return { ended: owned.length };
}
