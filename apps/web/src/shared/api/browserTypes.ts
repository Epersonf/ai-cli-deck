import { z } from 'zod';

export const BrowserStatusSchema = z.object({
  installed: z.boolean(),
  installing: z.boolean(),
  error: z.string().nullable(),
});
export const PageInfoSchema = z.object({ url: z.string(), title: z.string() });

export type BrowserStatus = z.infer<typeof BrowserStatusSchema>;
export type PageInfo = z.infer<typeof PageInfoSchema>;
export type BrowserInput =
  | { kind: 'click'; x: number; y: number }
  | { kind: 'type'; text: string }
  | { kind: 'key'; key: string }
  | { kind: 'scroll'; dy: number }
  | { kind: 'back' | 'forward' | 'reload' };
