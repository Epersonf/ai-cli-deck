import {
  CHAT_META,
  type CreateSessionBody,
  type ForkSessionBody,
  type OpenChatBody,
  type RestartSessionBody,
  type Session,
} from '@deck/shared';
import { HANDOVER_START, type ChatFilesPort } from '../domain/chat.js';
import { conflict, invalid, notFound } from '../domain/errors.js';
import type { ProviderRegistry } from '../domain/provider.js';
import type { ChatService } from './ChatService.js';
import { stripAnsi } from './stripAnsi.js';
import { transcriptFor } from './transcript.js';

/** How a CLI is started to carry on: its arguments, or a first message the deck types once it is up. */
interface Start {
  args: string[];
  typed: string | null;
}

/** A CLI that takes no first message on its command line gets it typed, once it has had time to start. */
const TYPE_AFTER_MS = 4000;
const SHELL = 'shell';
const SUBMIT_AFTER_MS = 300;

export interface ChatActionsDeps {
  chats: ChatService;
  sessions: {
    restart(id: string, plan: { provider: string; args: string[] }): Promise<void>;
    create(body: CreateSessionBody): Promise<Session>;
    sendInput(id: string, data: string): void;
    replay(id: string): Promise<Uint8Array>;
    setMeta(id: string, key: string, value: string): Promise<Record<string, string>>;
  };
  files: ChatFilesPort;
  providers: ProviderRegistry;
  now(): Date;
  wait(ms: number): Promise<void>;
}

/** Restarting, forking and moving conversations, between any CLIs. The agent is never asked anything. */
export class ChatActions {
  constructor(private readonly deps: ChatActionsDeps) {}

  /** Starts an ended terminal again: the same conversation (natively, or handed over), or a new one. */
  async restart(id: string, body: RestartSessionBody): Promise<void> {
    const { chats, sessions, files } = this.deps;
    const source = chats.must(id);
    if (source.status !== 'exited') throw conflict('Only an ended terminal can be restarted');
    const target = body.provider ?? source.provider;
    this.label(target); // unknown profile: fail before anything changes
    const chat = await chats.remember(id);
    const support = chats.support(target);
    let start: Start = { args: [], typed: null };
    const same = body.mode === 'continue' && target === source.provider;
    if (same && chat && support?.resume) start = { args: support.resume(chat.id), typed: null };
    // "The latest chat here" only for a CLI whose chats the deck cannot read: it could be another's.
    else if (same && support?.last && !support.format) start = { args: support.last, typed: null };
    else if (body.mode === 'continue') start = await this.handover(source, target);
    await files.forget(id);
    await sessions.restart(id, { provider: target, args: start.args });
    if (start.typed) this.typeLater(id, start.typed);
  }

  /** A new terminal carrying on this one's conversation: forked natively in the same CLI, else handed over. */
  async fork(id: string, body: ForkSessionBody): Promise<Session> {
    const { chats } = this.deps;
    const source = chats.must(id);
    if (source.parentId !== null) throw invalid('A sub-terminal has no conversation to fork');
    const target = body.provider ?? source.provider;
    this.label(target);
    const chat = await chats.remember(id);
    const support = chats.support(target);
    const start: Start =
      target === source.provider && chat && support?.fork
        ? { args: support.fork(chat.id), typed: null }
        : await this.handover(source, target);
    return this.launch({ provider: target, cwd: source.cwd }, start);
  }

  /** Continues a saved conversation (from the list) in a new terminal. */
  async open(body: OpenChatBody): Promise<Session> {
    const { chats } = this.deps;
    const chat = (await chats.list(body.provider, body.cwd)).find((c) => c.id === body.chatId);
    if (!chat) throw notFound(`Chat ${body.chatId}`);
    const resume = chats.support(body.provider)?.resume;
    if (!resume) throw invalid('This CLI cannot continue a saved chat');
    const created = await this.launch(body, { args: resume(chat.id), typed: null });
    await this.deps.sessions.setMeta(created.id, CHAT_META.chat, chat.id);
    return created;
  }

  /** The conversation written down for `target`, and how to start it reading that. */
  private async handover(source: Session, target: string): Promise<Start> {
    const { chats, files, now } = this.deps;
    if (target === SHELL) return { args: [], typed: null }; // a plain shell has no chat to continue
    const from = this.label(source.provider);
    const reader = chats.reader(source.provider);
    const chat = reader ? await chats.current(source.id) : null;
    const turns = chat && reader ? await reader.read(chat) : null;
    const screen = turns
      ? ''
      : stripAnsi(Buffer.from(await this.deps.sessions.replay(source.id)).toString('utf8'));
    const text = transcriptFor(turns, screen, { from, cwd: source.cwd, date: now() });
    if (text === null) return { args: [], typed: null };
    const stamp = now().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const file = await files.writeTranscript(source.cwd, `${stamp}-${source.id}.md`, text);
    const prompt =
      `${HANDOVER_START}${from} in this folder. ` +
      `Read ${file} first: it is that conversation so far. Then say in one short line that you ` +
      'have the context, and wait for the user.';
    const support = chats.support(target);
    return support?.prompt
      ? { args: support.prompt(prompt), typed: null }
      : { args: [], typed: prompt };
  }

  private async launch(where: { provider: string; cwd: string }, start: Start): Promise<Session> {
    const created = await this.deps.sessions.create({
      ...where,
      useWorktree: false,
      command: null,
      args: start.args,
      parentId: null,
    });
    if (start.typed) this.typeLater(created.id, start.typed);
    return created;
  }

  private typeLater(id: string, text: string): void {
    const { sessions, wait } = this.deps;
    void (async () => {
      await wait(TYPE_AFTER_MS);
      sessions.sendInput(id, text);
      await wait(SUBMIT_AFTER_MS);
      sessions.sendInput(id, '\r');
    })().catch(() => undefined);
  }

  private label(provider: string): string {
    const found = this.deps.providers.get(provider);
    if (!found) throw invalid(`Unknown profile "${provider}"`);
    return found.label;
  }
}
