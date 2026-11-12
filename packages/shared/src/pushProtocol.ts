import { z } from 'zod';
import { ApprovalRequestSchema } from './approval.js';
import { PREVIEW_TABS_MAX } from './browserProtocol.js';
import { MemoryScopeSchema } from './memory.js';
import { SessionSchema } from './session.js';

/** One socket per device for what changes anywhere on the deck, so the app need not ask over and over. */
export const EVENTS_WS_PATH = '/ws/events';

export const PushMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('session'), session: SessionSchema }),
  z.object({ type: z.literal('approval'), request: ApprovalRequestSchema }),
  /** The browser tabs a session has open, the same on every device. */
  z.object({
    type: z.literal('browser-tabs'),
    sessionId: z.string(),
    tabs: z.array(z.number().int()).max(PREVIEW_TABS_MAX),
  }),
  z.object({ type: z.literal('exit'), sessionId: z.string(), code: z.number().int().nullable() }),
  /** What a terminal is doing: printing right now (busy) or waiting, and its last line. */
  z.object({
    type: z.literal('activity'),
    sessionId: z.string(),
    busy: z.boolean(),
    summary: z.string(),
  }),
  /** The memory of a scope changed (any device): reload that screen. */
  z.object({
    type: z.literal('memory'),
    scope: MemoryScopeSchema,
    profileId: z.string().nullable(),
  }),
  /** An answer finished (or failed), or the agent needs a decision: show it on every device. */
  z.object({
    type: z.literal('notify'),
    sessionId: z.string(),
    title: z.string(),
    text: z.string(),
    reason: z.enum(['done', 'error', 'permission']),
  }),
]);
export type PushMessage = z.infer<typeof PushMessageSchema>;
