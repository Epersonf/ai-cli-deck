import { conflict } from '../domain/errors.js';
import type { ProfileService } from './ProfileService.js';
import type { SessionManager } from './SessionManager.js';

/** Deletes a profile and its data. It refuses while any terminal still runs on it, so no chat is lost silently. */
export async function removeProfile(
  deps: { profiles: ProfileService; sessions: SessionManager },
  id: string,
): Promise<void> {
  const open = deps.sessions.list().filter((s) => s.provider === id).length;
  if (open > 0) throw conflict(`Close its ${open} terminal(s) before deleting this profile`);
  await deps.profiles.remove(id);
  await deps.profiles.purgeData(id).catch(() => undefined);
}
