import type { ChatConfig, ChatEvent, ChatPartial, ChatUsage, ImageInput } from '@deck/shared';
import type {
  AgentConfig,
  AgentPort,
  AgentSink,
  AgentSpec,
  PermissionAnswer,
} from '../domain/agent.js';
import { invalid } from '../domain/errors.js';
import type { EventBus } from '../domain/events.js';
import type { ChatLogPort } from '../domain/ports.js';
import { ChatBook } from './ChatBook.js';
import { ChatEdits } from './ChatEdits.js';
import { chatSink } from './chatSink.js';
import { ChatSettings, type ModelSource, type RunState } from './ChatSettings.js';
import { ChatTuning } from './ChatTuning.js';
import { TurnNotice } from './TurnNotice.js';
import { TurnRunner } from './TurnRunner.js';
import type { UsageMeter } from './UsageMeter.js';

export interface RuntimeDeps {
  id: string;
  agent: AgentPort;
  log: ChatLogPort;
  bus: EventBus;
  meter: UsageMeter;
  /** A fresh uuid: the id of a `user` step, which Claude keeps as the message's uuid. */
  uuid(): string;
  now(): Date;
  spec(state: RunState): AgentSpec;
  remember(patch: { chatId?: string; config?: AgentConfig }): void;
  busy(busy: boolean): void;
  info: { agent: ChatConfig['agent']; models: ModelSource; label: string };
  initial: { config: AgentConfig; chatId: string | null; fork: boolean };
}

/** One session's conversation: its steps, the answer being written, and the agent run behind it. */
export class ChatRuntime {
  private readonly book: ChatBook;
  private readonly settings: ChatSettings;
  private readonly edits: ChatEdits;
  private readonly tuning: ChatTuning;
  private readonly runner: TurnRunner;
  private readonly sink: AgentSink;
  private busyNow = false;
  /** Messages typed while an answer was being written: sent, in order, when it ends (or one by one on request). */
  private queue: { id: string; text: string; images: readonly ImageInput[] }[] = [];
  private closing = false;

  constructor(private readonly deps: RuntimeDeps) {
    this.book = new ChatBook(deps.id, deps.log, deps.bus);
    this.settings = new ChatSettings(deps.initial, deps.info);
    this.edits = new ChatEdits(deps, this.book, this.settings);
    const notice = new TurnNotice(deps.id, deps.bus, this.book);
    this.runner = new TurnRunner({
      agent: deps.agent,
      book: this.book,
      settings: this.settings,
      notice,
      spec: deps.spec,
      sink: () => this.sink,
      isBusy: () => this.busyNow,
      setBusy: (busy) => this.setBusy(busy),
    });
    this.tuning = new ChatTuning({
      id: deps.id,
      bus: deps.bus,
      settings: this.settings,
      remember: deps.remember,
      run: () => this.runner.run,
    });
    this.sink = chatSink({
      book: this.book,
      settings: this.settings,
      meter: deps.meter,
      remember: deps.remember,
      reportModel: (model) => this.tuning.reported(model),
      pushUsage: () => this.pushUsage(),
      setBusy: (busy) => this.setBusy(busy),
      next: () => this.runner.dispatch(),
      finished: (error) => notice.ended(error),
      ended: () => (this.runner.run = null),
    });
  }

  readonly ready = (): Promise<void> => this.book.ready();
  readonly lastAnswer = (): string => this.book.lastAnswer();
  readonly recent = (): readonly ChatEvent[] => this.book.all();
  readonly usage = (): ChatUsage => this.deps.meter.current();
  readonly config = (): ChatConfig => this.settings.view();
  get isBusy(): boolean {
    return this.busyNow;
  }

  snapshot(): { events: ChatEvent[]; busy: boolean; partials: ChatPartial[]; config: ChatConfig } {
    this.deps.info.models.refresh();
    const events = [...this.book.all()];
    return { events, busy: this.busyNow, partials: this.book.pending(), config: this.config() };
  }

  readonly pushUsage = (): void =>
    this.deps.bus.publish({ kind: 'usage', sessionId: this.deps.id, usage: this.usage() });

  async send(text: string, images: readonly ImageInput[] = [], prompt = text): Promise<void> {
    await this.ready();
    const attachments = images.map((i) => ({ mediaType: i.mediaType, name: i.name ?? null }));
    const id = this.deps.uuid();
    this.book.add({ t: 'user', id, text, attachments, at: this.deps.now().toISOString() });
    this.runner.enqueue(id, prompt, images);
  }

  readonly queued = (): { id: string; text: string; images: number }[] =>
    this.queue.map((q) => ({ id: q.id, text: q.text, images: q.images.length }));

  /** Sends the message, or holds it in the queue while an answer is being written. */
  async sendOrQueue(text: string, images: readonly ImageInput[] = []): Promise<void> {
    if (!this.busyNow) return this.send(text, images);
    this.queue.push({ id: this.deps.uuid(), text, images });
    this.publishQueue();
  }

  /** Sends one queued message at once: it goes first, and the answer being written is stopped to make room. */
  async queueNow(id: string): Promise<void> {
    const at = this.queue.findIndex((q) => q.id === id);
    const [item] = at < 0 ? [] : this.queue.splice(at, 1);
    if (!item) return;
    this.queue.unshift(item);
    this.publishQueue();
    if (this.busyNow) this.interrupt();
    else await this.flushQueue();
  }

  queueDrop(id: string): void {
    const before = this.queue.length;
    this.queue = this.queue.filter((q) => q.id !== id);
    if (this.queue.length !== before) this.publishQueue();
  }

  private publishQueue(): void {
    this.deps.bus.publish({ kind: 'queue', sessionId: this.deps.id, items: this.queued() });
  }

  private async flushQueue(): Promise<void> {
    const items = this.queue.splice(0);
    if (items.length === 0) return;
    this.publishQueue();
    for (const item of items) await this.send(item.text, item.images);
  }

  async rewind(userId: string, text: string, images: readonly ImageInput[], files: boolean) {
    await this.ready();
    if (this.busyNow) throw invalid('Stop the answer before editing a message');
    this.runner.close();
    await this.send(text, images, await this.edits.goBack(userId, text, files));
  }

  readonly interrupt = (): void => this.runner.interrupt();
  readonly answer = (permissionId: string, answer: PermissionAnswer): void =>
    this.runner.run?.answer(permissionId, answer);
  readonly stopTask = (taskId: string): void => this.runner.run?.stopTask(taskId);
  readonly configure = (patch: Partial<AgentConfig>): void => this.tuning.configure(patch);
  readonly modelsChanged = (defaultChanged: boolean): void =>
    this.tuning.modelsChanged(defaultChanged);
  /** A line of information in the chat. */
  readonly notice = (text: string): void => this.book.add({ t: 'notice', level: 'info', text });
  readonly seed = (events: readonly ChatEvent[]): Promise<void> => this.book.replace(events);

  async clear(): Promise<void> {
    this.close();
    await this.edits.startOver();
  }

  close(): void {
    this.closing = true;
    this.runner.close();
    this.book.dropPartials();
    this.setBusy(false);
    this.closing = false;
    if (this.queue.length > 0) {
      this.queue = [];
      this.publishQueue();
    }
  }

  private setBusy(busy: boolean): void {
    if (busy === this.busyNow) return;
    this.busyNow = busy;
    this.deps.busy(busy);
    this.deps.bus.publish({ kind: 'busy', sessionId: this.deps.id, busy });
    if (!busy && !this.closing) void this.flushQueue().catch(() => undefined);
  }
}
