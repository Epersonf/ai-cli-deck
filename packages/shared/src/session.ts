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
  /** User-chosen display name; null means the default "provider · folder" label. */
  name: z.string().nullable().default(null),
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

export const ProviderStatusSchema = z.enum(['ready', 'missing']);
export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;

export const ProviderInfoSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** missing = the CLI is not installed. Sign-in is the CLI's own business. */
  status: ProviderStatusSchema,
  hint: z.string().nullable(),
  /** True when `clideck setup <id>` can download the CLI for the user. */
  canInstall: z.boolean(),
});
export type ProviderInfo = z.infer<typeof ProviderInfoSchema>;

export const RenameSessionBodySchema = z.object({
  name: z
    .string()
    .trim()
    .max(60)
    .transform((value) => (value === '' ? null : value))
    .nullable(),
});

export const CreateProfileBodySchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'use lowercase letters, digits and dashes'),
  base: z.enum(['claude', 'codex']),
  label: z.string().trim().min(1).max(60).nullable().default(null),
  /** Name of a host environment variable holding the API key (never the key itself). */
  keyEnv: z
    .string()
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
    .nullable()
    .default(null),
});
export type CreateProfileBody = z.infer<typeof CreateProfileBodySchema>;
