import type { ChatConfig, ChatEvent, ChatPartial, ChatUsage, ImageInput } from '@deck/shared';
import type { AgentConfig, PermissionAnswer } from '../domain/agent.js';
import { invalid } from '../domain/errors.js';
import type { RuntimeDeps } from './RuntimeDeps.js';
export type { RuntimeDeps } from './RuntimeDeps.js';
import { runtimeWiring } from './runtimeWiring.js';
import type { ChatRetry } from './ChatRetry.js';
import type { ChatCompaction } from './ChatCompaction.js';
import { ChatBook } from './ChatBook.js';
import { ChatEdits } from './ChatEdits.js';
import { ChatSettings } from './ChatSettings.js';
import type { ChatTuning } from './ChatTuning.js';
import { MessageQueue } from './MessageQueue.js';
import type { TurnRunner } from './TurnRunner.js';
/** One session's conversation: its steps, the answer being written, and the agent run behind it. */
export class ChatRuntime {
  private readonly book: ChatBook;
  private readonly settings: ChatSettings;
  private readonly edits: ChatEdits;
  private readonly tuning: ChatTuning;
  private readonly runner: TurnRunner;
  private busyNow = false;
  private readonly compaction: ChatCompaction;
  private readonly retry: ChatRetry;
  readonly queue: MessageQueue;

  constructor(private readonly deps: RuntimeDeps) {
    this.book = new ChatBook(deps.id, deps.log, deps.bus);
    this.queue = new MessageQueue(deps.id, deps.bus, deps.uuid, this);
    this.settings = new ChatSettings(deps.initial, deps.info);
    this.edits = new ChatEdits(deps, this.book, this.settings);
    ({
      runner: this.runner,
      tuning: this.tuning,
      compaction: this.compaction,
      retry: this.retry,
    } = runtimeWiring(deps, this.book, this.settings, {
      config: () => this.config(),
      isBusy: () => this.busyNow,
      setBusy: (busy, force) => this.setBusy(busy, force),
      submitCompact: () => this.submit('/compact', [], '/compact'),
      pushUsage: () => this.pushUsage(),
    }));
  }

  readonly ready = (): Promise<void> => this.book.ready();
  readonly lastAnswer = (): string => this.book.lastAnswer();
  readonly recent = (): readonly ChatEvent[] => this.book.all();
  readonly usage = (): ChatUsage => this.deps.meter.current();
  readonly config = (): ChatConfig => ({
    ...this.settings.view(),
    ...this.compaction.view(),
    retry: this.retry.view(),
  });
  readonly capabilities = () => this.compaction.capabilities();
  readonly restoreRetry = (): Promise<void> => this.retry.restore();
  readonly chooseRetry = (id: string, action: 'wait' | 'now' | 'cancel'): Promise<void> =>
    this.retry.choose(id, action);
  readonly compact = (): Promise<void> => this.compaction.compact();

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
    if (
      (this.deps.info.features?.compaction === 'native' ||
        (!this.deps.info.features && this.deps.info.agent === 'codex')) &&
      text.trim() === '/compact' &&
      images.length === 0
    )
      return this.compact();
    this.submit(text, images, prompt);
  }
  private submit(text: string, images: readonly ImageInput[], prompt: string): void {
    const attachments = images.map((i) => ({ mediaType: i.mediaType, name: i.name ?? null }));
    const id = this.deps.uuid();
    this.book.add({ t: 'user', id, text, attachments, at: this.deps.now().toISOString() });
    this.runner.enqueue(id, prompt, images);
  }
  async rewind(userId: string, text: string, images: readonly ImageInput[], files: boolean) {
    await this.ready();
    if (this.busyNow) throw invalid('Stop the answer before editing a message');
    this.runner.close();
    await this.send(text, images, await this.edits.goBack(userId, text, files));
  }
  readonly interrupt = (): void => {
    if (this.retry.view()) this.retry.cancel();
    else if (this.compaction.active) this.compaction.interrupt();
    else this.runner.interrupt();
  };
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
    this.tuning.push();
  }

  close(): void {
    this.retry.cancel(false);
    this.compaction.close();
    this.queue.drain(); // closing: nothing waiting goes out when the answer ends
    this.runner.close();
    this.book.dropPartials();
    this.setBusy(false);
  }
  private setBusy(busy: boolean, force = false): void {
    if (!force && busy === this.busyNow) return;
    this.busyNow = busy;
    this.deps.busy(busy);
    this.deps.bus.publish({ kind: 'busy', sessionId: this.deps.id, busy });
    if (!busy) void this.queue.flush().catch(() => undefined);
  }
}
