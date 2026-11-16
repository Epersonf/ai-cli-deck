import type { UsageReading } from '../../../domain/agent.js';
import { obj, type Json } from '../../codex/engine/codexJson.js';

const num = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0;

/** Live context-window update streamed via ACP `sessionUpdate: "usage_update"`. */
export function antigravityUsageUpdate(update: Json): UsageReading | null {
  if (update['sessionUpdate'] !== 'usage_update') return null;
  const hasUsed = typeof update['used'] === 'number' && Number.isFinite(update['used']);
  const hasSize = typeof update['size'] === 'number' && Number.isFinite(update['size']);
  const costVal = update['cost'];
  const cost =
    typeof costVal === 'number' && Number.isFinite(costVal)
      ? costVal
      : typeof obj(costVal)?.['amount'] === 'number'
        ? (obj(costVal)?.['amount'] as number)
        : undefined;

  if (!hasUsed && !hasSize && cost === undefined) return null;
  return {
    ...(hasUsed ? { contextTokens: Math.max(0, update['used'] as number) } : {}),
    ...(hasSize ? { contextWindow: Math.max(0, update['size'] as number) } : {}),
    ...(cost !== undefined ? { costUsd: cost } : {}),
  };
}

/** Completed prompt turn token metrics returned in the `session/prompt` response. */
export function antigravityPromptUsage(
  usageJson: unknown,
  turnId: string,
  startedAt: number,
): UsageReading | null {
  const usage = obj(usageJson);
  if (!usage) return null;
  const input = num(usage['inputTokens']);
  const output = num(usage['outputTokens']);
  const thought = num(usage['thoughtTokens']);
  const cached = num(usage['cachedReadTokens']);
  const write = usage['cachedWriteTokens'];
  const total = num(usage['totalTokens']);
  const totalOutput = output + thought;
  const durationMs = Math.max(0, Date.now() - startedAt);

  return {
    ...(total > 0 ? { contextTokens: total } : {}),
    turn: {
      id: turnId,
      input,
      cached,
      output: totalOutput,
      durationMs,
      at: new Date().toISOString(),
    },
    cache: {
      scope: 'turn',
      read: cached,
      write: typeof write === 'number' ? num(write) : null,
      uncached: Math.max(0, input - cached),
      ttlMs: null,
    },
  };
}
