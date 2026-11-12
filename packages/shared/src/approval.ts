import { z } from 'zod';
import { MemoryRequestSchema } from './memory.js';

export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalRequestSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  kind: z.enum(['worktree', 'folder', 'memory']),
  reason: z.string(),
  status: ApprovalStatusSchema,
  createdAt: z.string(),
  resultPath: z.string().nullable(),
  /** For a `folder` request: the folder the agent wants the session based in. */
  path: z.string().nullable().optional(),
  /** For a `memory` request: what the agent wants done with the deck's memory. */
  memory: MemoryRequestSchema.nullable().optional(),
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

export const ApprovalDecisionSchema = z.enum(['approve', 'reject']);
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
