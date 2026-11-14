import { watchCodexStream } from './codexStream.js';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { AgentConfig, AgentRun, AgentSink, AgentSpec, UserInput } from '../../domain/agent.js';
import { killTree } from '../process/killTree.js';
import { codexArgs } from './codexArgs.js';
import { resolveCodex } from './codexBin.js';
import { friendlyError, newCodexState } from './codexMap.js';
import { codexUsage } from './codexRollout.js';

/** How long Codex may take to exit after finishing a turn before it is cut. */
const REAP_AFTER_MS = 4000;

/** One conversation with Codex: every message is a `codex exec` run that resumes the same thread. */
export class CodexRun implements AgentRun {
  private child: ChildProcessWithoutNullStreams | null = null;
  private chatId: string | null;
  private config: AgentConfig;
  private stopped = false;
  private closed = false;
  private fork: boolean;
  /** A message sent while the previous turn's process is still winding down: it starts when that one ends. */
  private next: UserInput | null = null;

  constructor(
    private readonly spec: AgentSpec,
    private readonly sink: AgentSink,
  ) {
    this.chatId = spec.resumeId;
    this.fork = spec.fork;
    this.config = {
      model: spec.model,
      mode: spec.mode,
      effort: spec.effort,
      autoCompact: spec.autoCompact ?? null,
    };
  }

  send(input: UserInput): void {
    if (this.child) {
      this.next = input;
      return;
    }
    this.stopped = false;
    const spec = { ...this.spec, ...this.config, fork: this.fork };
    const bin = resolveCodex(spec.env);
    const args = [...bin.prefix, ...codexArgs(spec, this.chatId)];
    const child = spawn(bin.command, args, { cwd: spec.cwd, env: spec.env, stdio: 'pipe' });
    this.child = child;
    const state = newCodexState(`${input.id}:`);
    const sink: AgentSink = {
      ...this.sink,
      chatId: (id) => {
        this.chatId = id;
        this.fork = false;
        this.sink.chatId(id);
      },
    };
    watchCodexStream(
      child,
      state,
      sink,
      () => !this.closed,
      () => this.reap(child),
      (stderr) => {
        void this.finishedChild(child, state, spec, stderr);
      },
    );
    child.stdin.end(input.text);
  }

  private async finishedChild(
    child: ChildProcessWithoutNullStreams,
    state: ReturnType<typeof newCodexState>,
    spec: AgentSpec,
    stderr: string,
  ): Promise<void> {
    if (this.closed || this.child !== child) return;
    // Read before dispatching the queued turn: an old rollout must never overwrite newer metrics.
    if (state.finished && this.chatId) {
      const readings = await codexUsage(spec.env, this.chatId);
      if (this.closed || this.child !== child) return;
      readings.forEach((reading) => this.sink.usage(reading));
    }
    this.child = null;
    if (!state.finished) {
      const error = this.stopped
        ? null
        : friendlyError(state.lastError ?? (stderr.trim() || 'Codex stopped'));
      // Release the old run before turn-end dispatches a queued message.
      this.sink.ended();
      this.sink.event({ t: 'turn-end', error, costUsd: null, durationMs: null });
      return;
    }
    const next = this.next;
    this.next = null;
    if (next) this.send(next);
    else this.sink.ended();
  }

  /** Codex can linger after its turn is done (MCP connections, the sandbox service): cut it so the next turn can start. */
  private reap(child: ChildProcessWithoutNullStreams): void {
    setTimeout(() => {
      if (this.child === child) killTree(child);
    }, REAP_AFTER_MS).unref();
  }

  /** Codex has no background tasks the deck can stop. */
  stopTask(): void {
    // nothing to stop
  }

  interrupt(): void {
    this.stopped = true;
    this.next = null;
    if (this.child) killTree(this.child);
  }

  setConfig(patch: Partial<AgentConfig>): void {
    this.config = {
      model: patch.model !== undefined ? patch.model : this.config.model,
      mode: patch.mode ?? this.config.mode,
      effort: patch.effort !== undefined ? patch.effort : this.config.effort,
      autoCompact:
        patch.autoCompact !== undefined ? patch.autoCompact : (this.config.autoCompact ?? null),
    };
  }

  /** Codex runs unattended inside its sandbox: there is never a question to answer. */
  answer(): void {
    // nothing to answer
  }

  close(): void {
    this.closed = true;
    this.interrupt();
  }
}
