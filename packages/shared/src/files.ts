import { z } from 'zod';

export const FileEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  kind: z.enum(['file', 'dir']),
  /** True when git ignores this path (or it is .git / node_modules). */
  ignored: z.boolean(),
});
export type FileEntry = z.infer<typeof FileEntrySchema>;

export const TreeResponseSchema = z.object({ entries: z.array(FileEntrySchema) });
/** Files matching what was typed after `@`, best first. */
export const FindResponseSchema = z.object({ files: z.array(z.string()) });
export type TreeResponse = z.infer<typeof TreeResponseSchema>;

export const FileContentSchema = z.object({
  path: z.string(),
  content: z.string(),
  size: z.number().int(),
  truncated: z.boolean(),
  binary: z.boolean(),
});
export type FileContent = z.infer<typeof FileContentSchema>;

export const GitStatusSchema = z.object({
  isRepo: z.boolean(),
  branch: z.string().nullable(),
  changes: z.array(z.object({ path: z.string(), code: z.string() })),
});
export type GitStatus = z.infer<typeof GitStatusSchema>;
