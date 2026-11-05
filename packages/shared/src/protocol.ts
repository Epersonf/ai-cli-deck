import { z } from 'zod';
import { ApprovalRequestSchema } from './approval.js';
import { SessionSchema } from './session.js';

export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('input'), data: z.string() }),
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
  z.object({ type: z.literal('pong') }),
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
