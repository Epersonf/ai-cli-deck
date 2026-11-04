import type { LaunchSpec, MultiplexerPort, PtyHandle, PtyPort } from '../domain/ports.js';

const DEFAULT = { cols: 80, rows: 24 };

export class FakePty implements PtyHandle {
  readonly writes: string[] = [];
  size = { cols: 0, rows: 0 };
  killed = false;
  private dataListeners: Array<(data: Uint8Array) => void> = [];
  private exitListeners: Array<(code: number | null) => void> = [];

  write(data: string): void {
    this.writes.push(data);
  }
  resize(cols: number, rows: number): void {
    this.size = { cols, rows };
  }
  onData(listener: (data: Uint8Array) => void): void {
    this.dataListeners.push(listener);
  }
  onExit(listener: (code: number | null) => void): void {
    this.exitListeners.push(listener);
  }
  kill(): void {
    this.killed = true;
  }
  emit(text: string): void {
    this.dataListeners.forEach((l) => l(Buffer.from(text)));
  }
  exit(code: number): void {
    this.exitListeners.forEach((l) => l(code));
  }
}

export class FakePtyPort implements PtyPort {
  readonly spawned: Array<{ spec: LaunchSpec; pty: FakePty }> = [];
  spawn(spec: LaunchSpec): PtyHandle {
    const pty = new FakePty();
    this.spawned.push({ spec, pty });
    return pty;
  }
}

/** Records what would run, through `ptys` (wrapped in "tmux" when available). */
export class FakeMux implements MultiplexerPort {
  killed: string[] = [];
  constructor(
    readonly available: boolean,
    private live: string[] = [],
    private readonly ptys: PtyPort = new FakePtyPort(),
  ) {}
  launch(name: string, spec: LaunchSpec, size: { cols: number; rows: number }): PtyHandle {
    const args = this.available ? [name, spec.command] : spec.args;
    return this.ptys.spawn(
      { ...spec, command: this.available ? 'tmux' : spec.command, args },
      size,
    );
  }
  reattach(name: string, spec: LaunchSpec): PtyHandle {
    return this.ptys.spawn({ ...spec, command: 'tmux', args: ['attach', name] }, DEFAULT);
  }
  list(): Promise<string[]> {
    return Promise.resolve(this.live);
  }
  captured: Uint8Array | null = null;
  capture(): Promise<Uint8Array | null> {
    return Promise.resolve(this.captured);
  }
  kill(name: string): Promise<void> {
    this.killed.push(name);
    return Promise.resolve();
  }
}
