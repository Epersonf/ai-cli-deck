import { CHAT_META, type ChatInfo, type Session, type SessionChat } from '@deck/shared';
import type { ChatEntry, ChatFilesPort, ChatReader, ChatSupport } from '../domain/chat.js';
import { notFound } from '../domain/errors.js';
import type { EventBus } from '../domain/events.js';
import type { ProviderRegistry } from '../domain/provider.js';

/** A chat touched this long before its terminal's run started still counts as that run's (clock skew). */
const SKEW_MS = 2000;

export interface ChatSessions {
  get(id: string): Session | undefined;
  list(): Session[];
  setMeta(id: string, key: string, value: string): Promise<Record<string, string>>;
}

export interface ChatServiceDeps {
  sessions: ChatSessions;
  providers: ProviderRegistry;
  readers: Partial<Record<NonNullable<ChatSupport['format']>, ChatReader>>;
  files: ChatFilesPort;
  bus: EventBus;
}

export const toInfo = (entry: ChatEntry): ChatInfo => ({
  id: entry.id,
  title: entry.title,
  updatedAt: entry.updatedAt.toISOString(),
});

/**
 * Knows which conversation each terminal is on, without asking the agent: the CLI reports it (Claude Code's
 * start hook) or the deck finds it in the CLI's own chat files (the one touched during this terminal's run).
 */
export class ChatService {
  constructor(private readonly deps: ChatServiceDeps) {
    // The moment a program ends is when its chat is easiest to tell apart: keep the id with the session.
    deps.bus.subscribe((event) => {
      if (event.kind === 'exit') void this.remember(event.sessionId).catch(() => undefined);
    });
  }

  support(provider: string): ChatSupport | null {
    return this.deps.providers.get(provider)?.chat ?? null;
  }

  must(sessionId: string): Session {
    const session = this.deps.sessions.get(sessionId);
    if (!session) throw notFound(`Session ${sessionId}`);
    return session;
  }

  /** The saved chats of a profile in a folder, newest first. */
  async list(provider: string, cwd: string): Promise<ChatEntry[]> {
    const support = this.support(provider);
    const reader = support?.format ? this.deps.readers[support.format] : undefined;
    if (!support?.home || !reader) return [];
    return reader.list(support.home, cwd);
  }

  reader(provider: string): ChatReader | null {
    const format = this.support(provider)?.format;
    return (format && this.deps.readers[format]) || null;
  }

  /** The conversation a terminal is on, or was on when it ended. */
  async current(sessionId: string): Promise<ChatEntry | null> {
    const session = this.must(sessionId);
    const chats = await this.list(session.provider, session.cwd);
    if (chats.length === 0) return null;
    const byId = (id: string | null | undefined): ChatEntry | null =>
      (id && chats.find((chat) => chat.id === id)) || null;
    // A CLI that reports its chat is believed: an empty new chat means there is nothing to continue yet.
    const reported = await this.deps.files.reported(sessionId);
    if (reported) return byId(reported.id);
    // Otherwise: the chat this run used (resumed or first seen earlier), else the newest one it touched.
    const runAt = Date.parse(session.meta[CHAT_META.runAt] ?? session.createdAt) - SKEW_MS;
    const inRun = (chat: ChatEntry): boolean => chat.updatedAt.getTime() >= runAt;
    const known = byId(session.meta[CHAT_META.chat]);
    if (known && inRun(known)) return known;
    const others = await this.claimedByOthers(session);
    return chats.find((chat) => inRun(chat) && !others.has(chat.id)) ?? known;
  }

  /** What an ended terminal can offer for its conversation. */
  async info(sessionId: string, hasScreen: boolean): Promise<SessionChat> {
    const session = this.must(sessionId);
    const support = this.support(session.provider);
    const chat = await this.current(sessionId);
    const native = Boolean((chat && support?.resume) || (support?.last && !support.format));
    return { chat: chat ? toInfo(chat) : null, native, canContinue: native || !!chat || hasScreen };
  }

  /** Drops what a removed terminal's CLI reported. */
  forget(sessionId: string): Promise<void> {
    return this.deps.files.forget(sessionId);
  }

  /** Keeps the terminal's current chat id with the session (it survives restarts of the deck). */
  async remember(sessionId: string): Promise<ChatEntry | null> {
    const chat = await this.current(sessionId);
    const session = this.deps.sessions.get(sessionId);
    if (chat && session && session.meta[CHAT_META.chat] !== chat.id)
      await this.deps.sessions.setMeta(sessionId, CHAT_META.chat, chat.id);
    return chat;
  }

  /** Chats other terminals of the same profile in the same folder are on. */
  private async claimedByOthers(session: Session): Promise<Set<string>> {
    const others = this.deps.sessions
      .list()
      .filter(
        (s) => s.id !== session.id && s.cwd === session.cwd && s.provider === session.provider,
      );
    const reported = await Promise.all(others.map((s) => this.deps.files.reported(s.id)));
    const ids = [...others.map((s) => s.meta[CHAT_META.chat]), ...reported.map((r) => r?.id)];
    return new Set(ids.filter((id): id is string => Boolean(id)));
  }
}
