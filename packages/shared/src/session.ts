import { z } from 'zod';

export const SessionStatusSchema = z.enum(['starting', 'running', 'exited']);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const WorktreeInfoSchema = z.object({
  enabled: z.boolean(),
  path: z.string().nullable(),
  branch: z.string().nullable(),
});
export type WorktreeInfo = z.infer<typeof WorktreeInfoSchema>;

export const SessionSchema = z.object({
  id: z.string(),
  provider: z.string(),
  cwd: z.string(),
  status: SessionStatusSchema,
  createdAt: z.string(),
  previewUrl: z.string().nullable(),
  port: z.number().int(),
  worktree: WorktreeInfoSchema,
  persistent: z.boolean(),
  sharedCwdWith: z.array(z.string()),
});
export type Session = z.infer<typeof SessionSchema>;

export const CreateSessionBodySchema = z.object({
  provider: z.string().min(1),
  cwd: z.string().min(1),
  useWorktree: z.boolean().default(false),
  command: z.string().min(1).nullable().default(null),
  args: z.array(z.string()).default([]),
});
export type CreateSessionBody = z.infer<typeof CreateSessionBodySchema>;

export const ProviderInfoSchema = z.object({ id: z.string(), label: z.string() });
export type ProviderInfo = z.infer<typeof ProviderInfoSchema>;
