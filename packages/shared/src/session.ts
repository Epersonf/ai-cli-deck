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
  /** Set for a sub-terminal opened from another session (e.g. a plain shell in a folder, for git). */
  parentId: z.string().nullable().default(null),
  /** Small notes the agent keeps for itself (e.g. the id of its chat). Only `resume` means something to the deck. */
  meta: z.record(z.string(), z.string()).default({}),
});
export type Session = z.infer<typeof SessionSchema>;

export const CreateSessionBodySchema = z.object({
  provider: z.string().min(1),
  cwd: z.string().min(1),
  useWorktree: z.boolean().default(false),
  command: z.string().min(1).nullable().default(null),
  args: z.array(z.string()).default([]),
  /** Open this as a sub-terminal of that session (set by the server, not by clients). */
  parentId: z.string().min(1).nullable().optional(),
});
export type CreateSessionBody = z.infer<typeof CreateSessionBodySchema>;

/** Key whose value is the argument list that makes the session's own CLI continue its chat. */
export const RESUME_KEY = 'resume';
/** Key whose value is the argument list that makes the session's own CLI fork its chat (same profile). */
export const FORK_KEY = 'fork';
export const META_LIMITS = {
  keys: 12,
  keyLength: 32,
  valueLength: 500,
  totalLength: 3000,
} as const;

export const RestartSessionBodySchema = z.object({
  /** true: continue the chat saved under the "resume" note; false: start a fresh chat. */
  resume: z.boolean().default(true),
});

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
  /** Built-in CLI that `clideck setup` should install for this entry (profiles share their base's). */
  setupId: z.string().nullable().default(null),
  /** True for user-made profiles, which can be renamed. Built-in entries cannot. */
  profile: z.boolean().default(false),
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

export const HandoffInfoSchema = z.object({ updatedAt: z.string(), bytes: z.number().int() });
export type HandoffInfo = z.infer<typeof HandoffInfoSchema>;

export const ForkSessionBodySchema = z.object({
  /** Profile of the new terminal; the same one when omitted. */
  provider: z.string().min(1).optional(),
  /** Start from the handoff note when the CLI cannot fork natively. */
  useHandoff: z.boolean().default(true),
});
