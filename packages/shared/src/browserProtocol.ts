import { z } from 'zod';

/** Where the live picture of the session's Chromium streams (JPEG frames out, input in). */
export const BROWSER_WS_PATH = '/ws/browser';

/** Smallest and largest page size a device may ask for (CSS pixels). */
export const BROWSER_SIZE = { minWidth: 280, maxWidth: 1600, minHeight: 240, maxHeight: 2000 };

const coord = z.number().min(0).max(5000);
const delta = z.number().min(-5000).max(5000);

/** What a device sends over the browser socket. Coordinates are in page (CSS) pixels. */
export const BrowserClientMessageSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('click'), x: coord, y: coord }),
  z.object({ kind: z.literal('type'), text: z.string().min(1).max(2000) }),
  z.object({ kind: z.literal('key'), key: z.string().min(1).max(40) }),
  z.object({ kind: z.literal('scroll'), dy: delta, dx: delta.optional() }),
  z.object({ kind: z.enum(['back', 'forward', 'reload']) }),
  z.object({ kind: z.literal('navigate'), url: z.string().min(1).max(2048) }),
  z.object({
    kind: z.literal('resize'),
    width: z.number().int().min(BROWSER_SIZE.minWidth).max(BROWSER_SIZE.maxWidth),
    height: z.number().int().min(BROWSER_SIZE.minHeight).max(BROWSER_SIZE.maxHeight),
  }),
]);
export type BrowserClientMessage = z.infer<typeof BrowserClientMessageSchema>;

/** JSON the browser socket sends besides the frames (which go as binary JPEG). */
export const BrowserServerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('page'),
    url: z.string(),
    title: z.string(),
    width: z.number(),
    height: z.number(),
  }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
export type BrowserServerMessage = z.infer<typeof BrowserServerMessageSchema>;

export function parseBrowserClientMessage(raw: string): BrowserClientMessage | null {
  try {
    const parsed = BrowserClientMessageSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
