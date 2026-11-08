import { z } from 'zod';
import { ApprovalRequestSchema } from './approval.js';
import { SessionSchema } from './session.js';

export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('input'),
    data: z.string(),
    // Numbered per device so a resend after a reconnect is applied once; the server answers with `ack`.
    cid: z.string().max(64).optional(),
    seq: z.number().int().nonnegative().optional(),
  }),
  z.object({
    type: z.literal('resize'),
    // Smaller than this is a terminal that is not on screen yet; the program would redraw into garbage.
    cols: z.number().int().min(10).max(1000),
    rows: z.number().int().min(2).max(1000),
  }),
  z.object({ type: z.literal('ping') }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

/**
 * Terminal output travels as binary WebSocket frames (no JSON, no base64): the first byte says what the
 * rest is, the remaining bytes go to the terminal as they are.
 */
export const OUTPUT_FRAME = 0;
/** The screen as it is when a device connects (scrollback, screen, cursor and modes), sent once. */
export const REPLAY_FRAME = 1;

export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('status'), session: SessionSchema }),
  z.object({ type: z.literal('exit'), code: z.number().int().nullable() }),
  z.object({ type: z.literal('approval-request'), request: ApprovalRequestSchema }),
  z.object({ type: z.literal('preview-open'), url: z.string() }),
  /** The agent is using the session's Chromium: show it. */
  z.object({ type: z.literal('preview-browser') }),
  z.object({ type: z.literal('new-tab'), url: z.string() }),
  z.object({ type: z.literal('size'), cols: z.number().int(), rows: z.number().int() }),
  /** `lag`: how long (ms) the server's event loop was blocked lately; it delays every key. */
  z.object({ type: z.literal('pong'), lag: z.number().nonnegative().optional() }),
  /** Input numbered `seq` (and every one before it) reached the terminal. */
  z.object({ type: z.literal('ack'), seq: z.number().int().nonnegative() }),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const result = ClientMessageSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
