import type { Provider, ProviderRegistry } from '../../domain/provider.js';
import { createBuiltin } from './claude.js';
import { bundledManifests } from '../plugins/manifests.js';

/** The built-in agents, on this machine's own sign-in. Profiles (from templates) are added at runtime. */
export const PROVIDERS: readonly Provider[] = bundledManifests()
  .filter(({ manifest }) => manifest.machine)
  .map(({ manifest }) =>
    createBuiltin(manifest.template.id, manifest.template.label, manifest.template.agent),
  );

export function createProviderRegistry(
  providers: readonly Provider[] = PROVIDERS,
): ProviderRegistry {
  const byId = new Map(providers.map((p) => [p.id, p]));
  return {
    get: (id) => byId.get(id),
    list: () => [...byId.values()],
    add: (provider) => void byId.set(provider.id, provider),
    remove: (id) => void byId.delete(id),
  };
}
