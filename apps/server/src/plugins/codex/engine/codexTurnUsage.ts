import type { UsageReading } from '../../../domain/agent.js';
import type { Json } from './codexJson.js';
import type { CodexState } from './codexState.js';

/** Exec totals span all requests in a turn and must never be presented as context occupancy. */
export function codexTurnUsage(used: Json | null, state: CodexState): UsageReading | null {
  if (!used) return null;
  const number = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
  const input = number(used['input_tokens']);
  const cached = Math.min(input, number(used['cached_input_tokens']));
  const write = used['cache_write_input_tokens'];
  return {
    contextTokens: null,
    cache: {
      scope: 'turn',
      read: cached,
      write: typeof write === 'number' ? number(write) : null,
      uncached: Math.max(0, input - cached - number(write)),
      ttlMs: null,
    },
    turn: {
      id: state.itemPrefix,
      input,
      cached,
      output: number(used['output_tokens']),
      durationMs: Math.max(0, Date.now() - state.startedAt),
      at: new Date().toISOString(),
    },
  };
}
