import type { AgentKind } from '@deck/shared';
import type { AgentCapabilities, AgentPort, AgentSink, AgentSpec } from '../domain/agent.js';
import { invalid } from '../domain/errors.js';
import type { ChatBook } from './ChatBook.js';
import type { ChatSettings } from './ChatSettings.js';

interface Deps {
  agent: AgentPort;
  kind: AgentKind;
  strategy?: 'none' | 'message' | 'native';
  settings: ChatSettings;
  book: ChatBook;
  ready(): Promise<void>;
  spec(): AgentSpec;
  sink(): AgentSink;
  isBusy(): boolean;
  setBusy(busy: boolean): void;
  closeRun(): void;
  dispatch(): void;
  submit(): void;
  configChanged(): void;
}

/** Capability discovery and native compaction, independent of normal message turns. */
export class ChatCompaction {
  private discovery: Promise<AgentCapabilities> | null = null;
  private discoveredAt = 0;
  private canCompact: boolean;
  private controller: AbortController | null = null;
  private generation = 0;

  constructor(private readonly d: Deps) {
    this.canCompact = d.strategy === 'message' || (!d.strategy && d.kind === 'claude');
  }
  get active(): boolean {
    return this.controller !== null;
  }
  view() {
    return { canCompact: this.canCompact && !this.d.settings.run().fork, compacting: this.active };
  }

  capabilities(): Promise<AgentCapabilities> {
    if (this.discovery && Date.now() - this.discoveredAt < 300_000) return this.discovery;
    this.discoveredAt = Date.now();
    const defaults = { fork: this.d.kind === 'claude', compact: this.d.kind === 'claude' };
    this.discovery = (this.d.agent.capabilities?.(this.d.spec()) ?? Promise.resolve(defaults))
      .catch(() => ({ fork: false, compact: false }))
      .then((caps) => {
        this.canCompact = caps.compact;
        return caps;
      });
    return this.discovery;
  }

  async compact(): Promise<void> {
    const generation = this.generation;
    await this.d.ready();
    this.checkIdle();
    if (!this.d.settings.chatId || this.d.settings.run().fork)
      throw invalid('Send a message in this chat before compacting it');
    if (!(await this.capabilities()).compact)
      throw invalid('This agent version does not support manual compaction');
    this.checkIdle();
    if (generation !== this.generation) throw invalid('The conversation changed before compaction');
    if (this.d.strategy === 'message' || (!this.d.strategy && this.d.kind === 'claude')) {
      this.d.submit();
      return;
    }
    if (!this.d.agent.compact) throw invalid('Manual compaction is not supported');
    this.d.closeRun();
    const controller = new AbortController();
    this.controller = controller;
    this.d.setBusy(true);
    this.d.configChanged();
    this.notice('Compacting conversation…');
    const sink = this.d.sink();
    try {
      await this.d.agent.compact(
        this.d.spec(),
        {
          ...sink,
          usage: (reading) => {
            if (this.controller === controller && !controller.signal.aborted) sink.usage(reading);
          },
        },
        controller.signal,
      );
      if (this.controller === controller) this.notice('Conversation compacted.');
    } catch (error) {
      if (this.controller === controller)
        this.d.book.add({
          t: 'notice',
          level: 'error',
          text: error instanceof Error ? error.message : 'Compaction failed',
        });
    } finally {
      if (this.controller === controller) {
        this.controller = null;
        this.d.configChanged();
        this.d.setBusy(false);
        this.d.dispatch();
      }
    }
  }

  private checkIdle(): void {
    if (this.d.isBusy()) throw invalid('Wait for the current answer before compacting');
  }
  private notice(text: string): void {
    this.d.book.add({ t: 'notice', level: 'info', text });
  }
  interrupt(): void {
    this.controller?.abort();
  }
  close(): void {
    this.generation += 1;
    const active = this.active;
    this.controller?.abort();
    this.controller = null;
    if (active) this.d.configChanged();
  }
}
