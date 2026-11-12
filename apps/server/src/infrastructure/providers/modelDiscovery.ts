import type { AgentKind } from '@deck/shared';
import type { ModelListing } from '../../domain/provider.js';
import { sdkQuery } from '../agents/claudeQuery.js';
import { claudeModels } from './claudeModels.js';
import { codexModels } from './codexModels.js';
import { endpointModels } from './endpointModels.js';

/**
 * Which models an agent offers, asked of the source that knows: Codex's own catalog, another endpoint's
 * model list when the profile points at one, or Claude Code itself.
 */
export function discoverModels(
  agent: AgentKind,
  env: Record<string, string>,
): Promise<ModelListing> {
  if (agent === 'codex') return codexModels(env);
  if (env['ANTHROPIC_BASE_URL']) return endpointModels(env);
  return claudeModels(sdkQuery, env);
}
