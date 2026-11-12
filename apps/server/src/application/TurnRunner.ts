import type { ImageInput } from '@deck/shared';
import type { AgentPort, AgentRun, AgentSink, AgentSpec } from '../domain/agent.js';
import type { ChatBook } from './ChatBook.js';
import type { ChatSettings, RunState } from './ChatSettings.js';
import type { TurnNotice } from './TurnNotice.js';

export interface RunnerDeps {
  agent: AgentPort;
  book: ChatBook;
  settings: ChatSettings;
  notice: TurnNotice;
  spec(state: RunState): AgentSpec;
  /** What the agent reports into (made after the runner, so asked for when a run starts). */
  sink(): AgentSink;
  isBusy(): boolean;
  setBusy(busy: boolean): void;
}

/** Messages waiting for their turn, and the agent run that answers them one at a time. */
export class TurnRunner {
  /** The run behind the chat, while there is one. */
  run: AgentRun | null = null;
  /** `prompt` is what the agent is told: the text, or a replay in front of it. */
  private readonly queue: { id: string; prompt: string; images: readonly ImageInput[] }[] = [];

  constructor(private readonly d: RunnerDeps) {}

  enqueue(id: string, prompt: string, images: readonly ImageInput[]): void {
    this.queue.push({ id, prompt, images });
    if (!this.d.isBusy()) this.dispatch();
  }

  /** Starts the next waiting message, if any. */
  dispatch(): void {
    const next = this.queue.shift();
    if (!next) return;
    const { settings, book, notice } = this.d;
    this.d.setBusy(true);
    notice.began();
    book.add({ t: 'turn-start' });
    try {
      this.run ??= this.d.agent.start(this.d.spec(settings.run()), this.d.sink());
      settings.started();
      this.run.send({ id: next.id, text: next.prompt, images: next.images });
    } catch (error) {
      this.run = null;
      const message = error instanceof Error ? error.message : String(error);
      this.d.sink().event({ t: 'turn-end', error: message, costUsd: null, durationMs: null });
    }
  }

  /** Stops the answer being written and drops what was waiting. */
  interrupt(): void {
    this.d.notice.stop();
    this.queue.length = 0;
    this.run?.interrupt();
    if (this.d.isBusy() && !this.run)
      this.d.sink().event({ t: 'turn-end', error: null, costUsd: null, durationMs: null });
  }

  /** Ends the run (a later message starts a new one) and drops what was waiting. */
  close(): void {
    this.queue.length = 0;
    this.run?.close();
    this.run = null;
  }
}
