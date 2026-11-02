import type { Provider, ProviderRegistry } from '../../domain/provider.js';
import { claude } from './claude.js';
import { claudeDeepseek } from './claudeDeepseek.js';
import { codex } from './codex.js';
import { custom } from './custom.js';

/** To add a provider: create one file in this folder and add one line here. */
export const PROVIDERS: readonly Provider[] = [claude, codex, claudeDeepseek, custom];

export function createProviderRegistry(
  providers: readonly Provider[] = PROVIDERS,
): ProviderRegistry {
  const byId = new Map(providers.map((p) => [p.id, p]));
  return { get: (id) => byId.get(id), list: () => [...byId.values()] };
}
