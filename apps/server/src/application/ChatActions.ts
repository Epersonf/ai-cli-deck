import {
  CHAT_META,
  type ChatEvent,
  type CreateSessionBody,
  type ForkSessionBody,
  type OpenChatBody,
  type RestartSessionBody,
  type Session,
} from '@deck/shared';
import type { ChatFilesPort } from '../domain/chat.js';
import { invalid, notFound } from '../domain/errors.js';
import type { ProviderRegistry } from '../domain/provider.js';
import { eventsToTurns, turnsToEvents } from './chatHistory.js';
import type { ChatService } from './ChatService.js';
import type { CreateOptions } from './SessionManager.js';
import { handoverPrompt } from './handoverPrompt.js';

export interface ChatActionsDeps {
  chats: ChatService;
  sessions: {
    create(body: CreateSessionBody, options?: CreateOptions): Promise<Session>;
    send(id: string, text: string): Promise<void>;
    clear(id: string): Promise<void>;
    switchProvider(id: string, provider: string): Promise<void>;
    snapshotEvents(id: string): Promise<ChatEvent[]>;
    seed(id: string, events: ChatEvent[]): Promise<void>;
    supportsFork?(id: string): Promise<boolean>;
  };
  files: ChatFilesPort;
  providers: ProviderRegistry;
  now(): Date;
}

const newBody = (
  provider: string,
  cwd: string,
  parentId: string | null = null,
): CreateSessionBody => ({
  provider,
  cwd,
  useWorktree: false,
  chatId: null,
  parentId,
});

/** The settings a side chat takes over from the chat it branches from. */
const SETTINGS = [CHAT_META.model, CHAT_META.mode, CHAT_META.effort, CHAT_META.autoCompact];

/** Starting over, forking and moving conversations, between any agents. The agent is never asked anything. */
export class ChatActions {
  constructor(private readonly deps: ChatActionsDeps) {}

  /** A new conversation in the same session, or the conversation carried on by another profile's agent. */
  async restart(id: string, request: RestartSessionBody): Promise<void> {
    const { chats, sessions } = this.deps;
    const source = chats.must(id);
    const target = request.provider ?? source.provider;
    this.label(target); // unknown profile: fail before anything changes
    if (target === source.provider) {
      if (request.mode === 'new') await sessions.clear(id);
      return;
    }
    const prompt = request.mode === 'continue' ? await this.handover(source) : null;
    await sessions.switchProvider(id, target);
    if (prompt) await sessions.send(id, prompt);
  }

  /** A new session carrying on this one's conversation: forked natively in the same agent, else handed over. */
  async fork(id: string, request: ForkSessionBody): Promise<Session> {
    const { chats, sessions, providers } = this.deps;
    const source = chats.must(id);
    const target = request.provider ?? source.provider;
    this.label(target);
    const chatId = source.meta[CHAT_META.chat];
    const native =
      target === source.provider &&
      Boolean(chatId) &&
      ((!providers.get(target)?.features && providers.get(target)?.agent === 'claude') ||
        (await sessions.supportsFork?.(id)) === true);
    const created = await sessions.create(
      newBody(target, source.cwd),
      native && chatId
        ? {
            chatId,
            fork: true,
            briefingFrom: id,
            meta: Object.fromEntries(
              SETTINGS.flatMap((key) => (source.meta[key] ? [[key, source.meta[key]]] : [])),
            ),
          }
        : {},
    );
    if (native) await sessions.seed(created.id, await sessions.snapshotEvents(id));
    else await sessions.send(created.id, await this.handover(source));
    return created;
  }

  /**
   * A side chat: a copy of this conversation to ask something aside, kept under the same main session
   * (`parentId`), with the same profile and folder. Claude forks its saved chat; others get a handover.
   */
  async side(id: string): Promise<Session> {
    const { chats, sessions, providers } = this.deps;
    const source = chats.must(id);
    const chatId = source.meta[CHAT_META.chat];
    const native =
      Boolean(chatId) &&
      ((!providers.get(source.provider)?.features &&
        providers.get(source.provider)?.agent === 'claude') ||
        (await sessions.supportsFork?.(id)) === true);
    const meta = Object.fromEntries(
      SETTINGS.flatMap((key) => (source.meta[key] ? [[key, source.meta[key]]] : [])),
    );
    const created = await sessions.create(newBody(source.provider, source.cwd, source.id), {
      meta,
      ...(native && chatId ? { chatId, fork: true, briefingFrom: id } : {}),
    });
    const events = await sessions.snapshotEvents(id);
    if (native) await sessions.seed(created.id, events);
    else if (eventsToTurns(events).length > 0)
      await sessions.send(created.id, await this.handover(source));
    return created;
  }

  /** Continues a saved conversation (from the list) in a new session. */
  async open(request: OpenChatBody): Promise<Session> {
    const { chats, sessions, now } = this.deps;
    const list = await chats.list(request.provider, request.cwd);
    const chat = list.find((c) => c.id === request.chatId);
    const reader = chats.reader(request.provider);
    if (!chat || !reader) throw notFound(`Chat ${request.chatId}`);
    const created = await sessions.create(newBody(request.provider, request.cwd), {
      chatId: chat.id,
    });
    const turns = await reader.read(chat);
    await sessions.seed(created.id, turnsToEvents(turns, now().toISOString()));
    return created;
  }

  private handover(source: Session): Promise<string> {
    return handoverPrompt(source, this.deps);
  }

  private label(provider: string): string {
    const found = this.deps.providers.get(provider);
    if (!found) throw invalid(`Unknown profile "${provider}"`);
    return found.label;
  }
}
