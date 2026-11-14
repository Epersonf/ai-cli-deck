import type { ModelListing } from '../../domain/provider.js';
import type { QueryFn } from '../agents/claudeDriver.js';
import { withIdleQuery } from './claudeIdleQuery.js';

/**
 * Asks Claude Code which models this account can use (the SDK's `supportedModels`), through a query that
 * never gets a message: it only needs to start, answer and be closed again.
 */
export async function claudeModels(
  query: QueryFn,
  env: Record<string, string>,
): Promise<ModelListing> {
  const found = await withIdleQuery(query, env, (q) => q.supportedModels());
  const choices = found.map((m) => ({
    id: m.value,
    label: m.displayName || m.value,
    description: m.description || null,
  }));
  return { choices, current: env['ANTHROPIC_MODEL'] || null };
}
