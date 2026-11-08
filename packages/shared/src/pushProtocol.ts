import { z } from 'zod';
import { ApprovalRequestSchema } from './approval.js';
import { SessionSchema } from './session.js';

/** One socket per device for what changes anywhere on the deck, so the app need not ask over and over. */
export const EVENTS_WS_PATH = '/ws/events';

export const PushMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('session'), session: SessionSchema }),
  z.object({ type: z.literal('approval'), request: ApprovalRequestSchema }),
  z.object({ type: z.literal('exit'), sessionId: z.string(), code: z.number().int().nullable() }),
  /** What a terminal is doing: printing right now (busy) or waiting, and its last line. */
  z.object({
    type: z.literal('activity'),
    sessionId: z.string(),
    busy: z.boolean(),
    summary: z.string(),
  }),
]);
export type PushMessage = z.infer<typeof PushMessageSchema>;
