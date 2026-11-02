import { z } from 'zod';

export const FileEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  kind: z.enum(['file', 'dir']),
});
export type FileEntry = z.infer<typeof FileEntrySchema>;

export const TreeResponseSchema = z.object({ entries: z.array(FileEntrySchema) });
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
