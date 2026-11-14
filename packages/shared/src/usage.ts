import { z } from 'zod';

/** One usage window of the account (5-hour, weekly...): fraction used 0..1 and when it resets (ISO). */
export const UsageLimitSchema = z.object({
  /** Stable id of the window, e.g. `five_hour`; one account keeps one reading per key. */
  key: z.string(),
  label: z.string().nullable(),
  used: z.number().min(0).max(1),
  resetsAt: z.string().nullable(),
});
export type UsageLimit = z.infer<typeof UsageLimitSchema>;

/** The prompt cache as of the last answer; `ttlMs` is null when the agent does not say how long it lasts. */
export const UsageCacheSchema = z.object({
  /** Input tokens taken from the cache. */
  read: z.number().nonnegative(),
  /** Last model request, or the whole turn when only aggregated usage is available. */
  scope: z.enum(['request', 'turn']).optional(),
  /** Cache writes explicitly reported by the provider; null when unknown. */
  write: z.number().nonnegative().nullable(),
  /** Input processed without a cache read or a reported cache write. */
  uncached: z.number().nonnegative().optional(),
  ttlMs: z.number().positive().nullable(),
  /** When that answer came (ISO): the cache expires `ttlMs` after it. */
  at: z.string(),
});
export type UsageCache = z.infer<typeof UsageCacheSchema>;

export const TurnUsageSchema = z.object({
  id: z.string(),
  input: z.number().nonnegative(),
  cached: z.number().nonnegative(),
  output: z.number().nonnegative(),
  durationMs: z.number().nonnegative(),
  at: z.string(),
});
export type TurnUsage = z.infer<typeof TurnUsageSchema>;

export const UsageHistorySchema = z.object({
  turns: z.number().int().nonnegative(),
  input: z.number().nonnegative(),
  cached: z.number().nonnegative(),
  output: z.number().nonnegative(),
  durationMs: z.number().nonnegative(),
  /** The latest twenty turns; totals include earlier turns too. */
  recent: z.array(TurnUsageSchema).max(20),
});
export type UsageHistory = z.infer<typeof UsageHistorySchema>;

/** What the chat has used, for the usage meter. Any part may be unknown (null or empty) for an agent or endpoint. */
export const ChatUsageSchema = z.object({
  /** Cost of this chat so far, in USD. */
  costUsd: z.number().nullable(),
  /** Tokens in the model's context after the last answer, and the model's window. */
  contextTokens: z.number().nullable(),
  contextWindow: z.number().nullable(),
  /** The account's usage windows the agent has reported (shared by the chats of one profile). */
  limits: z.array(UsageLimitSchema).default([]),
  cache: UsageCacheSchema.nullable().default(null),
  history: UsageHistorySchema.optional(),
});
export type ChatUsage = z.infer<typeof ChatUsageSchema>;
