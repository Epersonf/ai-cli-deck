import { z } from 'zod';
import {
  ChatConfigSchema,
  ChatEventSchema,
  AutoCompactSchema,
  EffortSchema,
  ImageInputSchema,
  PartialSchema,
  PermissionModeSchema,
} from './agent.js';
import { ApprovalRequestSchema } from './approval.js';
import { SessionSchema } from './session.js';
import { ChatUsageSchema } from './usage.js';

/** What a device sends on a session's chat socket. */
export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('send'),
    text: z.string().max(200_000),
    images: z.array(ImageInputSchema).max(10).default([]),
    /** While an answer is being written, hold the message in the chat's queue (shown on every device) instead of sending it. */
    queue: z.boolean().optional(),
    // Numbered per device so a resend after a reconnect is applied once; the server answers with `ack`.
    cid: z.string().max(64).optional(),
    seq: z.number().int().nonnegative().optional(),
  }),
  /** Stop the answer in progress. */
  z.object({ type: z.literal('interrupt') }),
  /** Send a queued message now / drop it from the queue. */
  z.object({ type: z.literal('queue-now'), id: z.string() }),
  z.object({ type: z.literal('queue-drop'), id: z.string() }),
  /** Answer a `permission` event. */
  z.object({
    type: z.literal('permission'),
    id: z.string(),
    allow: z.boolean(),
    /** Also allow this kind of action for the rest of the chat. */
    always: z.boolean().optional(),
    message: z.string().max(2000).optional(),
    /** For an agent's question with options: the chosen answer per question text. */
    answers: z.record(z.string(), z.string().max(2000)).optional(),
  }),
  /** Change the model, permission mode or effort from the next message on (any may be left out). */
  z.object({
    type: z.literal('config'),
    model: z.string().max(200).nullable().optional(),
    mode: PermissionModeSchema.optional(),
    effort: EffortSchema.nullable().optional(),
    autoCompact: AutoCompactSchema.nullable().optional(),
  }),
  /**
   * Edit a sent message: the chat goes back to just before the `user` event `id` (everything after is
   * dropped, and Claude's file checkpoints are rewound when `revertFiles`), then `text` is sent in its place.
   */
  z.object({
    type: z.literal('rewind'),
    id: z.string(),
    text: z.string().max(200_000),
    images: z.array(ImageInputSchema).max(10).default([]),
    revertFiles: z.boolean().optional(),
  }),
  /** Stop a background task (`task` event id). */
  z.object({ type: z.literal('stop-task'), id: z.string() }),
  z.object({ type: z.literal('ping') }),
  /** Ask the account's usage windows now (the usage panel was opened), so they show before any answer. */
  z.object({ type: z.literal('usage-refresh') }),
  /** Native manual context compaction. Never sent as ordinary model input. */
  z.object({ type: z.literal('compact') }),
  /** This device has the chat open and in view (or not): finished answers are then not announced. */
  z.object({ type: z.literal('viewing'), viewing: z.boolean() }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('status'), session: SessionSchema }),
  /**
   * Sent once when a device connects: the whole conversation so far, whether an answer is being written
   * (`busy`) and the text it has so far (`partials`).
   */
  z.object({
    type: z.literal('replay'),
    events: z.array(ChatEventSchema),
    busy: z.boolean(),
    partials: z.array(PartialSchema),
    config: ChatConfigSchema,
  }),
  /** One new step of the conversation. */
  z.object({ type: z.literal('event'), event: ChatEventSchema }),
  /** More text of an answer being written; the finished `text`/`thinking` event with this id replaces it. */
  z.object({
    type: z.literal('delta'),
    id: z.string(),
    kind: z.enum(['text', 'thinking']),
    text: z.string(),
  }),
  z.object({ type: z.literal('busy'), busy: z.boolean() }),
  /** The messages waiting for the answer to end (the whole list, on connect and on every change). */
  z.object({
    type: z.literal('queue'),
    items: z.array(z.object({ id: z.string(), text: z.string(), images: z.number().int() })),
  }),
  /** Sent on connect and after each answer. */
  z.object({ type: z.literal('usage'), usage: ChatUsageSchema }),
  /** A `rewind` happened (here or on another device): drop the chat shown and show this one. */
  z.object({ type: z.literal('reset'), events: z.array(ChatEventSchema) }),
  z.object({ type: z.literal('config'), config: ChatConfigSchema }),
  z.object({ type: z.literal('approval-request'), request: ApprovalRequestSchema }),
  z.object({ type: z.literal('preview-open'), url: z.string() }),
  /** The agent is using the session's Chromium: show it. */
  z.object({ type: z.literal('preview-browser') }),
  z.object({ type: z.literal('new-tab'), url: z.string() }),
  /** `lag`: how long (ms) the server's event loop was blocked lately. */
  z.object({ type: z.literal('pong'), lag: z.number().nonnegative().optional() }),
  /** The `send` numbered `seq` (and every one before it) was taken. */
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
