import { z } from 'zod';

/** process: a command running in the background. battery / idle: a watcher that notifies the phone. */
export const TaskKindSchema = z.enum(['process', 'battery', 'idle']);
export type TaskKind = z.infer<typeof TaskKindSchema>;

export const TaskStatusSchema = z.enum(['running', 'done', 'failed', 'stopped']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/** A background job of a terminal, listed under its profile in the drawer. */
export const TaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: TaskKindSchema,
  status: TaskStatusSchema,
  /** The profile (provider id) of the terminal that owns it: tasks never cross profiles. */
  profile: z.string(),
  sessionId: z.string(),
  createdAt: z.string(),
  /** Latest news in a few words: "exit 0", "battery 12%", "quiet since 14:03"... */
  detail: z.string().default(''),
});
export type Task = z.infer<typeof TaskSchema>;

export const RunTaskBodySchema = z.object({
  command: z.string().trim().min(1).max(2000),
  name: z.string().trim().max(60).optional(),
});

/** A background task started from outside a terminal (another device's agent): in `cwd`, owned by `terminal`. */
export const StartTaskBodySchema = RunTaskBodySchema.extend({
  cwd: z.string().max(1000).optional(),
  /** The terminal it belongs to (it ends with it); default: this deck's "Background tasks" terminal. */
  terminal: z.string().max(80).optional(),
});

export const WatchBatteryBodySchema = z
  .object({
    below: z.number().int().min(1).max(99).optional(),
    above: z.number().int().min(1).max(99).optional(),
    text: z.string().trim().max(300).optional(),
    name: z.string().trim().max(60).optional(),
  })
  .refine((body) => body.below !== undefined || body.above !== undefined, {
    message: 'Give below and/or above (a battery percentage)',
  });

export const NotifyIdleBodySchema = z.object({ on: z.boolean() });
export const TaskLogSchema = z.object({ text: z.string() });
