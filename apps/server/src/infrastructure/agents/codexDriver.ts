import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import type {
  AgentConfig,
  AgentPort,
  AgentRun,
  AgentSink,
  AgentSpec,
  UserInput,
} from '../../domain/agent.js';
import { killTree } from '../process/killTree.js';
import { codexArgs } from './codexArgs.js';
import { resolveCodex } from './codexBin.js';
import { friendlyError, mapCodexLine, newCodexState } from './codexMap.js';
import { codexUsage } from './codexRollout.js';

/** How long Codex may take to exit after finishing a turn before it is cut. */
const REAP_AFTER_MS = 4000;

/** One conversation with Codex: every message is a `codex exec` run that resumes the same thread. */
class CodexRun implements AgentRun {
  private child: ChildProcessWithoutNullStreams | null = null;
  private chatId: string | null;
  private config: AgentConfig;
  private stopped = false;
  /** A message sent while the previous turn's process is still winding down: it starts when that one ends. */
  private next: UserInput | null = null;

  constructor(
    private readonly spec: AgentSpec,
    private readonly sink: AgentSink,
  ) {
    this.chatId = spec.resumeId;
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
    const spec = { ...this.spec, ...this.config };
    const bin = resolveCodex(spec.env);
    const args = [...bin.prefix, ...codexArgs(spec, this.chatId)];
    const child = spawn(bin.command, args, { cwd: spec.cwd, env: spec.env, stdio: 'pipe' });
    this.child = child;
    const state = newCodexState(`${input.id}:`);
    const sink: AgentSink = {
      ...this.sink,
      chatId: (id) => {
        this.chatId = id;
        this.sink.chatId(id);
      },
    };
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => (stderr = (stderr + String(chunk)).slice(-2000)));
    createInterface({ input: child.stdout }).on('line', (line) => {
      try {
        const json: unknown = JSON.parse(line);
        if (typeof json === 'object' && json !== null)
          mapCodexLine(json as Record<string, unknown>, state, sink);
        if (state.finished) this.reap(child);
      } catch {
        // not an event: Codex printed plain text
      }
    });
    child.on('error', (error) => {
      state.lastError = `Could not start Codex: ${error.message}`;
    });
    child.on('close', () => {
      this.child = null;
      // The rollout holds what the stream leaves out: the real context, the cache and the account's limits.
      if (state.finished && this.chatId)
        void codexUsage(spec.env, this.chatId).then((readings) =>
          readings.forEach((reading) => this.sink.usage(reading)),
        );
      if (!state.finished) {
        const error = this.stopped
          ? null
          : friendlyError(state.lastError ?? (stderr.trim() || 'Codex stopped'));
        this.sink.event({ t: 'turn-end', error, costUsd: null, durationMs: null });
      }
      const next = this.next;
      this.next = null;
      if (next) this.send(next);
      else this.sink.ended();
    });
    child.stdin.on('error', () => undefined);
    child.stdin.end(input.text);
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
    this.interrupt();
  }
}

/** Codex cannot go back inside a saved thread: an edited message starts a new one (the deck replays the chat). */
export const codexDriver: AgentPort = {
  start: (spec, sink) => new CodexRun(spec, sink),
  rewind: () => Promise.resolve({ resumeAt: null }),
};
