import type { CreateProfileBody, Profile } from '@deck/shared';
import type { ProfileServiceDeps } from './ProfileService.js';

/** A broken plugin must not leave an undeletable profile or a saved key behind. */
export async function registerNewProfile(
  deps: ProfileServiceDeps,
  profile: Profile,
  next: Profile[],
  body: CreateProfileBody,
): Promise<void> {
  try {
    if (body.secret) await deps.saveSecret(profile.id, body.secret);
    deps.register(profile);
    await deps.store.save(next);
  } catch (error) {
    deps.unregister(profile.id);
    await deps.wipeData(profile.id).catch(() => undefined);
    throw error;
  }
}
