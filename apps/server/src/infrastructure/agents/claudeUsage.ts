import type { UsageReading } from '../../domain/agent.js';

/** The SDK fields that tell usage. */
export interface UsageMessage {
  type?: string;
  total_cost_usd?: number;
  modelUsage?: Record<string, { contextWindow?: number }>;
  rate_limit_info?: {
    status?: string;
    resetsAt?: number;
    rateLimitType?: string;
    utilization?: number;
  };
  message?: {
    usage?: {
      input_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
      output_tokens?: number;
    };
  };
}

const LABELS: Record<string, string> = {
  five_hour: '5-hour limit',
  seven_day: 'Weekly limit',
  seven_day_opus: 'Weekly limit (Opus)',
  seven_day_sonnet: 'Weekly limit (Sonnet)',
  overage: 'Extra usage',
};

/** The account's window from a `rate_limit_event`; null when it says nothing about how much is used. */
function limitOf(info: NonNullable<UsageMessage['rate_limit_info']>): UsageReading['limit'] | null {
  const used = info.status === 'rejected' ? 1 : info.utilization;
  if (typeof used !== 'number' || Number.isNaN(used)) return null;
  return {
    used: Math.min(1, Math.max(0, used)),
    resetsAt: info.resetsAt ? new Date(info.resetsAt * 1000).toISOString() : null,
    label: LABELS[info.rateLimitType ?? ''] ?? null,
  };
}

/** What a message of the main conversation says about usage (null for the many that say nothing). */
export function usageOf(msg: UsageMessage): UsageReading | null {
  if (msg.type === 'rate_limit_event' && msg.rate_limit_info) {
    const limit = limitOf(msg.rate_limit_info);
    return limit ? { limit } : null;
  }
  if (msg.type === 'result') {
    const windows = Object.values(msg.modelUsage ?? {}).map((m) => m.contextWindow ?? 0);
    const window = Math.max(0, ...windows);
    return {
      ...(typeof msg.total_cost_usd === 'number' ? { costUsd: msg.total_cost_usd } : {}),
      ...(window > 0 ? { contextWindow: window } : {}),
    };
  }
  const usage = msg.type === 'assistant' ? msg.message?.usage : undefined;
  if (!usage) return null;
  const tokens =
    (usage.input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.output_tokens ?? 0);
  return tokens > 0 ? { contextTokens: tokens } : null;
}
