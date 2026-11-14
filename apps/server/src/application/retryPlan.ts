import type { ChatUsage, RetryHint } from '@deck/shared';

/** Use the latest applicable exhausted window, not a model-specific window belonging to another model. */
export function retryPlan(
  hint: RetryHint,
  usage: ChatUsage,
  attempt: number,
  now: number,
  model: string | null,
) {
  const times = [hint.retryAt ? Date.parse(hint.retryAt) : NaN];
  if (hint.kind !== 'overloaded')
    for (const limit of usage.limits) {
      if (limit.used < 1 || !limit.resetsAt) continue;
      if (limit.key.endsWith('_opus') && !model?.includes('opus')) continue;
      if (limit.key.endsWith('_sonnet') && !model?.includes('sonnet')) continue;
      times.push(Date.parse(limit.resetsAt));
    }
  const future = times.filter((time) => Number.isFinite(time) && time > now);
  const estimated = future.length === 0;
  const delay = Math.min(60_000 * 2 ** attempt, 15 * 60_000);
  const at = estimated ? now + delay : Math.max(...future) + 1500;
  return { retryAt: new Date(at + Math.floor(Math.random() * 1000)).toISOString(), estimated };
}
