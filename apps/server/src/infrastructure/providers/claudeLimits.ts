import type { AccountLimit } from '../../domain/agent.js';
import type { QueryFn } from '../agents/claudeDriver.js';
import { LABELS } from '../agents/claudeUsage.js';
import { withIdleQuery } from './claudeIdleQuery.js';

/** The windows `/usage` lists, in the order they are shown. */
const WINDOWS = ['five_hour', 'seven_day', 'seven_day_opus', 'seven_day_sonnet'] as const;

interface Window {
  utilization?: number | null;
  resets_at?: string | null;
}

/**
 * The plan's usage windows, asked of Claude Code (the data behind `/usage`) without sending a message.
 * Empty when the account has no plan limits (an API key, another endpoint) or Claude Code cannot say.
 */
export async function claudeLimits(
  query: QueryFn,
  env: Record<string, string>,
): Promise<AccountLimit[]> {
  const answer = await withIdleQuery(query, env, (q) => {
    const ask = q.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET;
    return ask ? ask.call(q, { skipBehaviors: true }) : Promise.resolve(null);
  });
  const limits = answer?.rate_limits;
  if (!answer?.rate_limits_available || !limits) return [];
  return WINDOWS.flatMap((key): AccountLimit[] => {
    const w = limits[key] as Window | null | undefined;
    if (typeof w?.utilization !== 'number') return [];
    return [
      {
        key,
        label: LABELS[key] ?? null,
        used: Math.min(1, Math.max(0, w.utilization / 100)),
        resetsAt: w.resets_at ?? null,
      },
    ];
  });
}
