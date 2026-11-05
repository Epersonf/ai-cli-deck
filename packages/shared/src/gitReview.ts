import { z } from 'zod';

/** One changed path, relative to the repository root. `from` is the old path of a rename. */
export const GitChangeSchema = z.object({
  path: z.string(),
  code: z.string(),
  from: z.string().optional(),
});
export type GitChange = z.infer<typeof GitChangeSchema>;

/** What the review pane shows: the repository a session works in and everything changed in it. */
export const GitReviewSchema = z.object({
  isRepo: z.boolean(),
  /** Repository folder name, for display. */
  repo: z.string().nullable(),
  branch: z.string().nullable(),
  /** Commits not pushed yet (null without an upstream). */
  ahead: z.number().int().nullable(),
  changes: z.array(GitChangeSchema),
});
export type GitReview = z.infer<typeof GitReviewSchema>;

export const GitDiffSchema = z.object({
  path: z.string(),
  diff: z.string(),
  truncated: z.boolean(),
});
export type GitDiff = z.infer<typeof GitDiffSchema>;

export const GitPathBodySchema = z.object({ path: z.string().min(1).max(4096) });

export const GitCommitBodySchema = z.object({
  message: z.string().trim().min(1).max(10_000),
  paths: z.array(z.string().min(1).max(4096)).min(1).max(5000),
});
export type GitCommitBody = z.infer<typeof GitCommitBodySchema>;

export const GitResultSchema = z.object({ output: z.string() });
export type GitResult = z.infer<typeof GitResultSchema>;
