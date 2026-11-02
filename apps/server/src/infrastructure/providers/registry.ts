import type { Provider, ProviderRegistry } from '../../domain/provider.js';
import { claude } from './claude.js';
import { claudeDeepseek } from './claudeDeepseek.js';
import { codex } from './codex.js';
import { custom } from './custom.js';
import { shell } from './shell.js';

/** To add a provider: create one file in this folder and add one line here. */
export const PROVIDERS: readonly Provider[] = [shell, claude, codex, claudeDeepseek, custom];

/** Configured providers are applied last, so they can add new CLIs or override built-ins. */
export function createProviderRegistry(
  providers: readonly Provider[] = PROVIDERS,
  configured: readonly Provider[] = [],
): ProviderRegistry {
  const byId = new Map([...providers, ...configured].map((p) => [p.id, p]));
  return { get: (id) => byId.get(id), list: () => [...byId.values()] };
}
