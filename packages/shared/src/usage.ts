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
  /** Input tokens that were not: written to the cache, or sent without it. */
  write: z.number().nonnegative(),
  ttlMs: z.number().positive().nullable(),
  /** When that answer came (ISO): the cache expires `ttlMs` after it. */
  at: z.string(),
});
export type UsageCache = z.infer<typeof UsageCacheSchema>;

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
});
export type ChatUsage = z.infer<typeof ChatUsageSchema>;
