import type { ProfileService } from './ProfileService.js';
import type { SessionManager } from './SessionManager.js';

/** Deleting a profile ends its terminals first. Its CLI config folder is left on disk. */
export async function removeProfile(
  deps: { profiles: ProfileService; sessions: SessionManager },
  id: string,
): Promise<{ ended: number }> {
  const owned = deps.sessions.list().filter((s) => s.provider === id);
  await deps.profiles.remove(id);
  for (const session of owned) await deps.sessions.remove(session.id);
  return { ended: owned.length };
}
