import type { ChatUsage } from '@deck/shared';

/** Unknown Codex retention is a risk estimate, never a claimed provider expiry. */
const CODEX_IDLE_RISK_MS = 60 * 60 * 1000;
export interface CacheWarning {
  estimated: boolean;
  tokens: number | null;
}

export function cacheWarning(
  usage: ChatUsage | null,
  agent: string | undefined,
  busy: boolean,
  now = Date.now(),
  estimatedIdleRiskMs?: number | null,
): CacheWarning | null {
  if (busy || !usage?.cache) return null;
  const cache = usage.cache;
  const at = Date.parse(cache.at);
  if (!Number.isFinite(at) || at > now) return null;
  const estimate =
    estimatedIdleRiskMs !== undefined
      ? estimatedIdleRiskMs
      : agent === 'codex'
        ? CODEX_IDLE_RISK_MS
        : null;
  const ttl = cache.ttlMs ?? estimate;
  if (ttl === null || now - at < ttl) return null;
  return {
    estimated: cache.ttlMs === null,
    tokens: usage.contextTokens !== null && usage.contextTokens > 0 ? usage.contextTokens : null,
  };
}
