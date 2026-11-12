import type { Provider, ProviderRegistry } from '../../domain/provider.js';
import { claude } from './claude.js';
import { codex } from './codex.js';

/** The built-in agents, on this machine's own sign-in. Profiles (from templates) are added at runtime. */
export const PROVIDERS: readonly Provider[] = [claude, codex];

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
