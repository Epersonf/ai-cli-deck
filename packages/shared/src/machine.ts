import { z } from 'zod';

/** Longest a command run through `/api/exec` may take (longer work belongs in a terminal there). */
export const EXEC_MAX_SECONDS = 280;

/** A command to run on this machine and wait for (what an agent on a paired deck asks for). */
export const ExecBodySchema = z.object({
  command: z.string().min(1).max(8000),
  /** Folder to run in (`~` allowed); default: the deck's default folder. */
  cwd: z.string().max(1000).optional(),
  timeoutSec: z.number().int().min(1).max(EXEC_MAX_SECONDS).default(120),
});
export type ExecBody = z.infer<typeof ExecBodySchema>;

export const ExecResultSchema = z.object({
  /** Null when it was stopped (timeout). */
  exitCode: z.number().nullable(),
  /** stdout and stderr as they came, the end kept when it is long. */
  output: z.string(),
  truncated: z.boolean(),
  timedOut: z.boolean(),
  /** What ran it, e.g. "cmd.exe" or "/bin/bash", and the OS ("win32", "linux"...). */
  shell: z.string(),
  platform: z.string(),
  cwd: z.string(),
});
export type ExecResult = z.infer<typeof ExecResultSchema>;

/** Text typed into a terminal; `enter` presses Enter after it (default). */
export const TerminalInputBodySchema = z.object({
  text: z.string().max(20_000),
  enter: z.boolean().default(true),
});

/** A terminal's screen as plain text: the last `lines` rows with something on them. */
export const ScreenTextSchema = z.object({ text: z.string(), cols: z.number(), rows: z.number() });
export type ScreenText = z.infer<typeof ScreenTextSchema>;
