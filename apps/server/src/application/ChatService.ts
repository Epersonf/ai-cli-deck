import { CHAT_META, type ChatInfo, type Session, type SessionChat } from '@deck/shared';
import type { ChatEntry, ChatReader } from '../domain/chat.js';
import { notFound } from '../domain/errors.js';
import type { ProviderRegistry } from '../domain/provider.js';

/** Reading every chat's first request is not free: the automatic names are reused for this long. */
const TITLES_TTL_MS = 15_000;
const TITLE_CHARS = 60;

export interface ChatSessions {
  get(id: string): Session | undefined;
  list(): Session[];
  firstRequest(id: string): Promise<string>;
  hasChat(id: string): Promise<boolean>;
}

export interface ChatServiceDeps {
  sessions: ChatSessions;
  providers: ProviderRegistry;
  readers: Record<string, ChatReader>;
}

export const toInfo = (entry: ChatEntry): ChatInfo => ({
  id: entry.id,
  title: entry.title,
  updatedAt: entry.updatedAt.toISOString(),
});

const shorten = (text: string): string => {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > TITLE_CHARS ? `${line.slice(0, TITLE_CHARS - 1)}…` : line;
};

/** What each session's conversation is, and the saved conversations of the agents' own chat files. */
export class ChatService {
  private titleCache: { at: number; value: Record<string, string> } | null = null;

  constructor(private readonly deps: ChatServiceDeps) {}

  must(sessionId: string): Session {
    const session = this.deps.sessions.get(sessionId);
    if (!session) throw notFound(`Session ${sessionId}`);
    return session;
  }

  reader(provider: string): ChatReader | null {
    const format = this.deps.providers.get(provider)?.chat?.format;
    return (format && this.deps.readers[format]) || null;
  }

  /** The saved chats of a profile in a folder, newest first. */
  async list(provider: string, cwd: string): Promise<ChatEntry[]> {
    const support = this.deps.providers.get(provider)?.chat;
    const reader = this.reader(provider);
    return support && reader ? reader.list(support.home, cwd) : [];
  }

  /** What a session can do with its conversation. */
  async info(sessionId: string): Promise<SessionChat> {
    const session = this.must(sessionId);
    const id = session.meta[CHAT_META.chat];
    const title = await this.deps.sessions.firstRequest(sessionId);
    const chat: ChatInfo | null = id
      ? { id, title: shorten(title), updatedAt: new Date().toISOString() }
      : null;
    return { chat, native: Boolean(id), canContinue: await this.deps.sessions.hasChat(sessionId) };
  }

  /** The automatic name of each session that has a conversation: the first thing asked in it. */
  async titles(): Promise<Record<string, string>> {
    if (this.titleCache && Date.now() - this.titleCache.at < TITLES_TTL_MS) {
      return this.titleCache.value;
    }
    const value: Record<string, string> = {};
    for (const session of this.deps.sessions.list()) {
      const first = shorten(await this.deps.sessions.firstRequest(session.id));
      if (first !== '') value[session.id] = first;
    }
    this.titleCache = { at: Date.now(), value };
    return value;
  }
}
