import { join } from 'node:path';
import type { AccountLimit } from '../../domain/agent.js';
import { codexHome, lastReadings, newestFirst } from './codexRollout.js';

/** How many of the newest rollouts are looked through for a count that carries the windows. */
const LOOK_AT = 8;

/**
 * The account's usage windows as Codex last wrote them in a rollout (it records them with every answer).
 * Codex has no way to ask without running, so this is as fresh as the last answer, on any chat of the profile.
 */
export async function codexLimits(env: Record<string, string>): Promise<AccountLimit[]> {
  const root = join(codexHome(env), 'sessions');
  let looked = 0;
  for (const year of await newestFirst(root))
    for (const month of await newestFirst(join(root, year)))
      for (const day of await newestFirst(join(root, year, month))) {
        const dir = join(root, year, month, day);
        for (const name of await newestFirst(dir)) {
          if (!name.endsWith('.jsonl') || looked++ >= LOOK_AT) return [];
          const limits = (await lastReadings(join(dir, name)).catch(() => [])).flatMap((r) =>
            r.limit ? [r.limit] : [],
          );
          if (limits.length) return limits;
        }
      }
  return [];
}
