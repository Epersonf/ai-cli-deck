import { conflict } from '../domain/errors.js';
import type { ProfileService } from './ProfileService.js';
import type { SessionManager } from './SessionManager.js';

/** Deletes a profile and its data. It refuses while any terminal still runs on it, so no chat is lost silently. */
/**
 * Deletes a profile and its data. With terminals still open it refuses, unless `force` is set: then they
 * are ended first (a recursive delete), so no chat is lost without the caller asking for it.
 */
export async function removeProfile(
  deps: { profiles: ProfileService; sessions: SessionManager },
  id: string,
  force: boolean = false,
): Promise<{ ended: number }> {
  const owned = deps.sessions.list().filter((s) => s.provider === id);
  if (owned.length > 0 && !force)
    throw conflict(`Close its ${owned.length} terminal(s) first, or delete with force to end them`);
  await deps.profiles.remove(id);
  let ended = 0;
  for (const session of owned) {
    try {
      await deps.sessions.remove(session.id);
      ended += 1;
    } catch {
      // a terminal that refuses to end must not keep the profile alive
    }
  }
  await deps.profiles.purgeData(id).catch(() => undefined);
  return { ended };
}
