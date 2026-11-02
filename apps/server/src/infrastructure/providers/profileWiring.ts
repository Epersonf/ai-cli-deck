import { join } from 'node:path';
import type { ProviderRegistry } from '../../domain/provider.js';
import { ProfileService } from '../../application/ProfileService.js';
import { JsonProfileStore } from '../store/JsonProfileStore.js';
import { createProfileProvider } from './profileProvider.js';
import type { ProviderStatusResolver } from './status.js';

interface Deps {
  configDir: string;
  providers: ProviderRegistry;
  status: ProviderStatusResolver;
  defaultShell: string;
}

/** Loads saved profiles and keeps registry + install status in sync when they change. */
export async function createProfileService(deps: Deps): Promise<ProfileService> {
  const profilesDir = join(deps.configDir, 'profiles');
  const reserved = deps.providers.list().map((p) => p.id);
  const service = new ProfileService({
    store: new JsonProfileStore(join(deps.configDir, 'profiles.json')),
    reservedIds: () => reserved,
    unregister: (id) => {
      deps.providers.remove(id);
      deps.status.unregister(id);
    },
    register: (profile) => {
      deps.providers.add(createProfileProvider(profile, profilesDir));
      if (profile.base === 'custom')
        deps.status.register({ id: profile.id, command: profile.command || deps.defaultShell });
      else deps.status.alias(profile.id, profile.base === 'codex' ? 'codex' : 'claude');
    },
  });
  await service.load();
  return service;
}
