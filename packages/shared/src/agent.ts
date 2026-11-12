import { z } from 'zod';

/** Which agent engine drives a session. Both talk to the model themselves; the deck only renders the chat. */
export const AgentKindSchema = z.enum(['claude', 'codex']);
export type AgentKind = z.infer<typeof AgentKindSchema>;

/** Claude's permission modes (auto: a classifier decides, dontAsk: deny what is not pre-approved); Codex maps them to its sandbox (plan: read-only, bypass: full access, the rest: workspace). */
export const PermissionModeSchema = z.enum([
  'default',
  'acceptEdits',
  'auto',
  'dontAsk',
  'plan',
  'bypassPermissions',
]);
export type PermissionMode = z.infer<typeof PermissionModeSchema>;

export const EffortSchema = z.enum(['low', 'medium', 'high']);
export type Effort = z.infer<typeof EffortSchema>;

/** An image or PDF the person attached to a message (sent as base64, never stored in the chat log). */
export const ImageInputSchema = z.object({
  mediaType: z.string().max(100),
  data: z.string().max(14_000_000),
  name: z.string().max(200).optional(),
});
export type ImageInput = z.infer<typeof ImageInputSchema>;

/**
 * One step of a conversation, the same for every agent. The server keeps these in a per-session log
 * (so a reload, another device or a restart shows the chat) and sends them live as `event` messages.
 * Ids tie a tool result and a permission answer to what they answer.
 */
export const ChatEventSchema = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('user'),
    id: z.string(),
    text: z.string(),
    /** Attachments are not kept: only what they were. */
    attachments: z
      .array(z.object({ mediaType: z.string(), name: z.string().nullable() }))
      .default([]),
    at: z.string(),
  }),
  /** A finished piece of the assistant's answer (markdown). Replaces the partial text with the same id. */
  z.object({ t: z.literal('text'), id: z.string(), text: z.string() }),
  z.object({ t: z.literal('thinking'), id: z.string(), text: z.string() }),
  /** The agent started a tool: `name` is the agent's own (Bash, Edit, Read, shell, apply_patch...). */
  z.object({ t: z.literal('tool'), id: z.string(), name: z.string(), input: z.unknown() }),
  z.object({
    t: z.literal('tool-result'),
    /** The `tool` event it answers. */
    id: z.string(),
    output: z.string(),
    isError: z.boolean().default(false),
  }),
  /** The agent asks before using a tool. Answered with a client `permission` message. */
  z.object({
    t: z.literal('permission'),
    id: z.string(),
    tool: z.string(),
    input: z.unknown(),
    /** The person may allow this kind of action for the rest of the chat. */
    canAlways: z.boolean().default(false),
    reason: z.string().nullable().default(null),
  }),
  z.object({
    t: z.literal('permission-done'),
    id: z.string(),
    allowed: z.boolean(),
  }),
  z.object({ t: z.literal('turn-start') }),
  z.object({
    t: z.literal('turn-end'),
    /** Set when the turn failed (not signed in, bad key, network...). */
    error: z.string().nullable().default(null),
    costUsd: z.number().nullable().default(null),
    durationMs: z.number().nullable().default(null),
  }),
  z.object({ t: z.literal('notice'), level: z.enum(['info', 'error']), text: z.string() }),
  /** A background job the agent started (a dev server, a build...). Upserted by id; shown in the tasks panel. */
  z.object({
    t: z.literal('task'),
    id: z.string(),
    title: z.string(),
    state: z.enum(['running', 'done', 'failed', 'stopped']),
  }),
]);
export type ChatEvent = z.infer<typeof ChatEventSchema>;

/** A model the agent offers. The list comes from the agent or its endpoint at run time, never from the deck's code. */
export const ModelChoiceSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().nullable().default(null),
});
export type ModelChoice = z.infer<typeof ModelChoiceSchema>;

/** What the person may change about the running chat, and what is on offer. */
export const ChatConfigSchema = z.object({
  agent: AgentKindSchema,
  /** The model picked for this chat; null: the default of the profile/agent is used. */
  model: z.string().nullable(),
  /** The model actually answering now (as the agent reported it); null until known. */
  effectiveModel: z.string().nullable().default(null),
  /** The default the person set for this provider/profile; null: the agent's own default. */
  defaultModel: z.string().nullable().default(null),
  mode: PermissionModeSchema,
  effort: EffortSchema.nullable(),
  /** Models for the picker, discovered at run time (any text is still accepted). May be empty. */
  modelChoices: z.array(ModelChoiceSchema),
  /** The conversation id the agent saved (what "continue" resumes); null before the first answer. */
  chatId: z.string().nullable(),
});
export type ChatConfig = z.infer<typeof ChatConfigSchema>;

/** Text of an answer being written, not yet a finished `text`/`thinking` event. */
export const PartialSchema = z.object({
  id: z.string(),
  kind: z.enum(['text', 'thinking']),
  text: z.string(),
});
export type ChatPartial = z.infer<typeof PartialSchema>;

/** What the chat has used, for the usage meter. Any part may be unknown (null) for an agent or endpoint. */
export const ChatUsageSchema = z.object({
  /** Cost of this chat so far, in USD. */
  costUsd: z.number().nullable(),
  /** Tokens in the model's context after the last answer, and the model's window. */
  contextTokens: z.number().nullable(),
  contextWindow: z.number().nullable(),
  /** The account's usage window (e.g. the 5-hour limit): fraction used 0..1 and when it resets (ISO). */
  limitUsed: z.number().min(0).max(1).nullable(),
  limitResetsAt: z.string().nullable(),
  limitLabel: z.string().nullable(),
});
export type ChatUsage = z.infer<typeof ChatUsageSchema>;
