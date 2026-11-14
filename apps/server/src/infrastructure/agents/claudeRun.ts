import type {
  AgentConfig,
  AgentRun,
  AgentSink,
  AgentSpec,
  PermissionAnswer,
  UserInput,
} from '../../domain/agent.js';
import type { QueryFn, QueryLike } from './claudeDriver.js';
import { mapClaudeMessage, newMapState, type SdkMessage } from './claudeMap.js';
import { applyAutoCompact, claudeMode, claudeOptions, claudeUserMessage } from './claudeOptions.js';
import { ClaudePermissions } from './claudePermissions.js';
import { runningTasks, stopTasks } from './claudeTasks.js';
import { markAuth } from '../../domain/authError.js';
import { cutRun, stopAnswer } from './claudeStop.js';
import { IdleTimer } from './idleTimer.js';
import { InputChannel } from './inputChannel.js';

/** A run nobody has talked to for this long is closed (the next message resumes the chat). */
const IDLE_CLOSE_MS = 15 * 60_000;

/** A message of the main conversation that is the agent speaking. */
const isOwnAnswer = (msg: SdkMessage): boolean =>
  (msg.type === 'stream_event' || msg.type === 'assistant') && !msg.parent_tool_use_id;

/** One conversation with Claude: a long-lived SDK query fed by an input channel. */
export class ClaudeRun implements AgentRun {
  private readonly input = new InputChannel<Record<string, unknown>>();
  private readonly permissions: ClaudePermissions;
  private readonly abort = new AbortController();
  private readonly state = newMapState();
  private query: QueryLike | null = null;
  private turn = false;
  /** Closes the run when idle, but never while background tasks (a dev server...) still run in it. */
  private readonly idle = new IdleTimer(
    IDLE_CLOSE_MS,
    () => !this.turn && runningTasks(this.state.tasks) > 0,
    () => this.close(),
  );
  private readonly cut = (): void => cutRun(this.abort, this.query);
  private stderr = '';
  private interrupted = false;
  /** The sink, with an answer the person stopped reported as finished rather than failed. */
  private readonly out: AgentSink;

  constructor(
    private readonly spec: AgentSpec,
    private readonly sink: AgentSink,
    private readonly queryFn: QueryFn,
  ) {
    this.permissions = new ClaudePermissions(sink);
    this.out = {
      ...sink,
      event: (e) => sink.event(e.t === 'turn-end' && this.interrupted ? { ...e, error: null } : e),
    };
  }

  send(input: UserInput): void {
    this.idle.clear();
    this.turn = true;
    this.interrupted = false;
    this.input.push(claudeUserMessage(input.id, input.text, input.images));
    if (!this.query) void this.consume();
  }

  private async consume(): Promise<void> {
    const options = claudeOptions(this.spec, {
      abortController: this.abort,
      canUseTool: this.permissions.ask,
      stderr: (data: unknown) => (this.stderr = (this.stderr + String(data)).slice(-2000)),
    });
    let failure: string | null = null;
    try {
      this.query = this.queryFn({ prompt: this.input.iterate(), options });
      for await (const msg of this.query) {
        // The agent can start an answer by itself (told a background task ended).
        if (!this.turn && isOwnAnswer(msg)) this.begin();
        mapClaudeMessage(msg, this.state, this.out);
        if (msg.type === 'result') this.turnOver();
      }
    } catch (error) {
      if (!this.abort.signal.aborted)
        failure = error instanceof Error ? error.message : String(error);
    } finally {
      this.finish(failure);
    }
  }

  private begin(): void {
    this.idle.clear();
    this.turn = true;
    this.sink.event({ t: 'turn-start' });
  }

  private finish(failure: string | null): void {
    this.permissions.denyAll();
    stopTasks(this.state.tasks, this.sink);
    if (this.turn) {
      this.turn = false;
      const stopped = this.abort.signal.aborted;
      this.sink.event({
        t: 'turn-end',
        error:
          stopped || this.interrupted
            ? null
            : markAuth(failure ?? (this.stderr.trim() || 'The agent stopped')),
        costUsd: null,
        durationMs: null,
      });
    }
    this.input.close();
    this.sink.ended();
  }

  private turnOver(): void {
    this.turn = false;
    this.stderr = '';
    this.idle.start();
  }

  interrupt(): void {
    if (!this.query) return;
    this.interrupted = true;
    stopAnswer(this.query, () => this.cut());
  }

  setConfig(patch: Partial<AgentConfig>): void {
    const q = this.query;
    if (patch.model !== undefined)
      void q?.setModel(patch.model ?? undefined).catch(() => undefined);
    if (patch.mode) void q?.setPermissionMode(claudeMode(patch.mode)).catch(() => undefined);
    if (patch.autoCompact !== undefined) applyAutoCompact(q, patch.autoCompact);
  }

  answer(id: string, answer: PermissionAnswer): void {
    this.permissions.answer(id, answer);
  }

  stopTask(taskId: string): void {
    void this.query?.stopTask(taskId).catch(() => undefined);
  }

  close(): void {
    this.idle.clear();
    this.input.close();
    if (this.turn) this.cut();
  }
}
