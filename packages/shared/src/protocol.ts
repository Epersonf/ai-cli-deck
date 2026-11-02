import { z } from 'zod';
import { ApprovalRequestSchema } from './approval.js';
import { SessionSchema } from './session.js';

export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('input'), data: z.string() }),
  z.object({
    type: z.literal('resize'),
    cols: z.number().int().min(1).max(1000),
    rows: z.number().int().min(1).max(1000),
  }),
  z.object({ type: z.literal('ping') }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('output'), data: z.string(), replay: z.boolean() }),
  z.object({ type: z.literal('status'), session: SessionSchema }),
  z.object({ type: z.literal('exit'), code: z.number().int().nullable() }),
  z.object({ type: z.literal('approval-request'), request: ApprovalRequestSchema }),
  z.object({ type: z.literal('preview-open'), url: z.string() }),
  z.object({ type: z.literal('new-tab'), url: z.string() }),
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
