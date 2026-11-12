import { z } from 'zod';

/**
 * CLIs whose own chat files the deck reads: it then knows each terminal's conversation without asking the
 * agent, lists the saved ones, and can hand a conversation over to another AI.
 */
export const ChatFormatSchema = z.enum(['claude', 'codex']);
export type ChatFormat = z.infer<typeof ChatFormatSchema>;

/** Chat ids go on a command line: plain ids only, never something that looks like an option. */
export const CHAT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** One saved conversation of a CLI in a folder. */
export const ChatInfoSchema = z.object({
  id: z.string(),
  /** Its first request, shortened. */
  title: z.string(),
  updatedAt: z.string(),
});
export type ChatInfo = z.infer<typeof ChatInfoSchema>;

/** What a terminal can do with its conversation (shown when it has ended). */
export const SessionChatSchema = z.object({
  chat: ChatInfoSchema.nullable(),
  /** The CLI continues the chat itself (its own resume), with everything it had. */
  native: z.boolean(),
  /** There is something to continue from: the chat, or at least what the terminal showed. */
  canContinue: z.boolean(),
});
export type SessionChat = z.infer<typeof SessionChatSchema>;

export const RestartSessionBodySchema = z.object({
  /** `continue`: the same conversation; `new`: a fresh one. */
  mode: z.enum(['continue', 'new']).default('continue'),
  /** Continue in another profile: the conversation is handed over as a transcript. */
  provider: z.string().min(1).optional(),
});
export type RestartSessionBody = z.infer<typeof RestartSessionBodySchema>;

/** A new terminal that carries on this one's conversation, in the same profile (a fork) or another. */
export const ForkSessionBodySchema = z.object({
  provider: z.string().min(1).optional(),
});
export type ForkSessionBody = z.infer<typeof ForkSessionBodySchema>;

/** Continue a saved conversation (from the list) in a new terminal. */
export const OpenChatBodySchema = z.object({
  provider: z.string().min(1),
  cwd: z.string().min(1),
  chatId: z.string().regex(CHAT_ID),
});
export type OpenChatBody = z.infer<typeof OpenChatBodySchema>;

/** Session notes the deck keeps about the conversation (in `Session.meta`). */
export const CHAT_META = {
  /** When the program last started (ISO): chats touched after it belong to this run. */
  runAt: 'runAt',
  /** The conversation id the terminal last had. */
  chat: 'chat',
  /** The settings picked in the chat (kept so a restart or another device sees the same). */
  model: 'model',
  mode: 'mode',
  effort: 'effort',
} as const;
