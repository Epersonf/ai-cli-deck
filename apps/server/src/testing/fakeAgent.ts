import type { ChatEvent } from '@deck/shared';
import type {
  AgentConfig,
  AgentPort,
  AgentRun,
  AgentSink,
  AgentSpec,
  PermissionAnswer,
  RewindResult,
  UserInput,
} from '../domain/agent.js';
import type { ChatLogPort, ProcessHandle, ProcessPort, ProcessSpec } from '../domain/ports.js';

/** One run started by the fake port: what it was told, and a way to play the agent's side. */
export class FakeRun implements AgentRun {
  readonly sent: UserInput[] = [];
  readonly answers: Array<[string, PermissionAnswer]> = [];
  readonly configs: Array<Partial<AgentConfig>> = [];
  readonly stopped: string[] = [];
  interrupted = 0;
  closed = false;

  constructor(
    readonly spec: AgentSpec,
    readonly sink: AgentSink,
  ) {}

  send(input: UserInput): void {
    this.sent.push(input);
  }
  interrupt(): void {
    this.interrupted += 1;
  }
  setConfig(patch: Partial<AgentConfig>): void {
    this.configs.push(patch);
  }
  answer(id: string, answer: PermissionAnswer): void {
    this.answers.push([id, answer]);
  }
  stopTask(taskId: string): void {
    this.stopped.push(taskId);
  }
  close(): void {
    this.closed = true;
  }

  /** The agent finishes the turn with this answer. */
  reply(text: string): void {
    this.sink.event({ t: 'text', id: `m${this.sent.length}`, text });
    this.sink.event({ t: 'turn-end', error: null, costUsd: null, durationMs: null });
  }
}

export class FakeAgentPort implements AgentPort {
  readonly runs: FakeRun[] = [];
  failWith: Error | null = null;
  /** What `rewind` answers, and what it was asked. */
  rewindTo: RewindResult = { resumeAt: null };
  readonly rewinds: Array<{ userId: string; revertFiles: boolean; spec: AgentSpec }> = [];

  rewind(spec: AgentSpec, userId: string, revertFiles: boolean): Promise<RewindResult> {
    this.rewinds.push({ userId, revertFiles, spec });
    return Promise.resolve(this.rewindTo);
  }

  start(spec: AgentSpec, sink: AgentSink): AgentRun {
    if (this.failWith) throw this.failWith;
    const run = new FakeRun(spec, sink);
    this.runs.push(run);
    return run;
  }

  get last(): FakeRun {
    const run = this.runs.at(-1);
    if (!run) throw new Error('no run started');
    return run;
  }
}

export class FakeChatLog implements ChatLogPort {
  readonly logs = new Map<string, ChatEvent[]>();
  load(id: string): Promise<ChatEvent[]> {
    return Promise.resolve([...(this.logs.get(id) ?? [])]);
  }
  append(id: string, events: readonly ChatEvent[]): Promise<void> {
    this.logs.set(id, [...(this.logs.get(id) ?? []), ...events]);
    return Promise.resolve();
  }
  replace(id: string, events: readonly ChatEvent[]): Promise<void> {
    this.logs.set(id, [...events]);
    return Promise.resolve();
  }
  remove(id: string): Promise<void> {
    this.logs.delete(id);
    return Promise.resolve();
  }
}

/** A background command the test controls. */
export class FakeProcess implements ProcessHandle {
  private data: ((chunk: Uint8Array) => void)[] = [];
  private exit: ((code: number | null) => void)[] = [];
  killed = false;
  constructor(readonly spec: ProcessSpec) {}
  onData(listener: (chunk: Uint8Array) => void): void {
    this.data.push(listener);
  }
  onExit(listener: (code: number | null) => void): void {
    this.exit.push(listener);
  }
  kill(): void {
    this.killed = true;
  }
  print(text: string): void {
    this.data.forEach((l) => l(new TextEncoder().encode(text)));
  }
  finish(code: number | null): void {
    this.exit.forEach((l) => l(code));
  }
}

export class FakeProcessPort implements ProcessPort {
  readonly spawned: FakeProcess[] = [];
  spawn(spec: ProcessSpec): ProcessHandle {
    const process = new FakeProcess(spec);
    this.spawned.push(process);
    return process;
  }
}
