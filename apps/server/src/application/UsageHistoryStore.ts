import type { UsageHistory } from '@deck/shared';

/** Optional private telemetry. Failure to persist it must not interrupt a conversation. */
export interface UsageHistoryStore {
  read(sessionId: string): UsageHistory | null;
  write(sessionId: string, history: UsageHistory | null): void;
  remove(sessionId: string): void;
}
