import type { ChatConfig, ChatEvent, ChatUsage, ImageInput } from '@deck/shared';
import type { AgentConfig, PermissionAnswer } from '../domain/agent.js';
import { recentText } from './chatRepair.js';
import type { ChatRuntime } from './ChatRuntime.js';
import type { SessionRegistry } from './SessionRegistry.js';

/** What can be done with the conversations of the sessions: talk, stop, answer, configure, read. */
export class SessionChats {
  constructor(protected readonly reg: SessionRegistry) {}

  protected chatOf(id: string): ChatRuntime {
    return this.reg.require(id).chat;
  }

  async send(id: string, text: string, images: readonly ImageInput[] = []): Promise<void> {
    await this.chatOf(id).send(text, images);
  }
  readonly interrupt = (id: string): void => this.chatOf(id).interrupt();
  readonly stopTask = (id: string, task: string): void => this.chatOf(id).stopTask(task);
  readonly notice = (id: string, text: string): void => this.chatOf(id).notice(text);
  readonly usage = (id: string): ChatUsage => this.chatOf(id).usage();

  /** Edits a sent message: the chat goes back to before it and `text` is sent instead. */
  async rewind(
    id: string,
    edit: {
      messageId: string;
      text: string;
      images?: readonly ImageInput[];
      revertFiles?: boolean;
    },
  ): Promise<void> {
    const { messageId, text, images = [], revertFiles = false } = edit;
    await this.chatOf(id).rewind(messageId, text, images, revertFiles);
  }
  readonly answer = (id: string, permission: string, answer: PermissionAnswer): void =>
    this.chatOf(id).answer(permission, answer);
  readonly configure = (id: string, patch: Partial<AgentConfig>): void =>
    this.chatOf(id).configure(patch);

  /** The conversation for a device that connects. */
  async snapshot(id: string): Promise<ReturnType<ChatRuntime['snapshot']>> {
    const chat = this.chatOf(id);
    await chat.ready();
    return chat.snapshot();
  }

  async settings(id: string): Promise<ChatConfig> {
    return (await this.snapshot(id)).config;
  }

  /** Every step of the conversation kept so far. */
  async snapshotEvents(id: string): Promise<ChatEvent[]> {
    return (await this.snapshot(id)).events;
  }

  /** The recent conversation as text lines (for agent tools). */
  async recent(id: string, lines: number): Promise<string> {
    const chat = this.chatOf(id);
    await chat.ready();
    return recentText(chat.recent(), lines);
  }

  /** What the person asked first in this session ('' before any message). */
  async firstRequest(id: string): Promise<string> {
    const chat = this.reg.runtimes.get(id)?.chat;
    if (!chat) return '';
    await chat.ready();
    const first = chat.recent().find((e) => e.t === 'user');
    return first?.t === 'user' ? first.text : '';
  }

  async hasChat(id: string): Promise<boolean> {
    const chat = this.reg.runtimes.get(id)?.chat;
    if (!chat) return false;
    await chat.ready();
    return chat.recent().some((e) => e.t === 'user');
  }

  readonly lastAnswer = (id: string): string => this.reg.runtimes.get(id)?.chat.lastAnswer() ?? '';
  readonly isBusy = (id: string): boolean => this.reg.runtimes.get(id)?.chat.isBusy ?? false;

  /** Shows these steps as the start of the conversation (a saved chat opened here). */
  readonly seed = (id: string, events: readonly ChatEvent[]): Promise<void> =>
    this.chatOf(id).seed(events);

  /** A new conversation in the same session. */
  async clear(id: string): Promise<void> {
    await this.chatOf(id).clear();
  }
}
