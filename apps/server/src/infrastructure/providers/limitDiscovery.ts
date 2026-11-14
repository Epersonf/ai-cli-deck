import type { AgentKind } from '@deck/shared';
import type { AccountLimit } from '../../domain/agent.js';
import { sdkQuery } from '../agents/claudeQuery.js';
import { codexLimits } from '../agents/codexLimits.js';
import { claudeLimits } from './claudeLimits.js';

/**
 * The account's usage windows, asked of what knows them: Codex's own rollouts, or Claude Code. Another
 * endpoint (DeepSeek...) has no plan windows to ask for.
 */
export function discoverLimits(
  agent: AgentKind,
  env: Record<string, string>,
): Promise<AccountLimit[]> {
  if (agent === 'codex') return codexLimits(env);
  if (env['ANTHROPIC_BASE_URL']) return Promise.resolve([]);
  return claudeLimits(sdkQuery, env);
}
