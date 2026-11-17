import type { UsageReading } from '../../../domain/agent.js';
import { obj, type Json } from '../../codex/engine/codexJson.js';

/** xAI counts money in ticks of 1e-10 US dollars. */
const TICKS_PER_USD = 1e10;
const num = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0;

/** What Grok Build reports in `session/prompt`'s `_meta.usage`: the tokens and cost of the whole turn. */
export function grokPromptUsage(
  response: Json,
  turnId: string,
  contextWindow: number | undefined,
): { reading: UsageReading; costUsd: number } | null {
  const usage = obj(obj(response['_meta'])?.['usage']);
  if (!usage) return null;
  const calls = Math.max(1, num(usage['modelCalls']));
  const input = num(usage['inputTokens']);
  const cached = num(usage['cachedReadTokens']);
  const costUsd = num(usage['costUsdTicks']) / TICKS_PER_USD;
  return {
    costUsd,
    reading: {
      // A turn can call the model several times; one call's prompt is the context in use.
      contextTokens: Math.round(input / calls),
      ...(contextWindow ? { contextWindow } : {}),
      turn: {
        id: turnId,
        input,
        cached,
        output: num(usage['outputTokens']),
        durationMs: num(usage['apiDurationMs']),
        at: new Date().toISOString(),
      },
      cache: {
        scope: 'turn',
        read: cached,
        write: num(usage['cacheCreationTokens']),
        uncached: Math.max(0, input - cached),
        ttlMs: null,
      },
    },
  };
}
