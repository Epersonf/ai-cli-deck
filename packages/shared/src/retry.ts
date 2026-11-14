import { z } from 'zod';

/** Only temporary provider failures are eligible for automatic continuation. */
export const RetryHintSchema = z.object({
  kind: z.enum(['usage', 'rate', 'overloaded']),
  retryAt: z.string().datetime().nullable(),
});
export type RetryHint = z.infer<typeof RetryHintSchema>;

/** Saved with the session; contains references and timing, never prompts, keys or attachments. */
export const ChatRetrySchema = z.object({
  id: z.string().max(80),
  sourceId: z.string().max(80),
  threadId: z.string().max(128).nullable(),
  kind: RetryHintSchema.shape.kind,
  status: z.enum(['offered', 'waiting']),
  retryAt: z.string().datetime(),
  estimated: z.boolean(),
  attempt: z.number().int().min(0).max(5),
});
export type ChatRetry = z.infer<typeof ChatRetrySchema>;
