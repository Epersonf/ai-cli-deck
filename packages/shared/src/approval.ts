import { z } from 'zod';

export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalRequestSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  kind: z.literal('worktree'),
  reason: z.string(),
  status: ApprovalStatusSchema,
  createdAt: z.string(),
  resultPath: z.string().nullable(),
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

export const ApprovalDecisionSchema = z.enum(['approve', 'reject']);
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
