import type { Session } from '@deck/shared';
import type {
  LaunchSpec,
  MultiplexerPort,
  PtyHandle,
  PtyPort,
  SessionStorePort,
  SystemPort,
} from '../domain/ports.js';

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

export class FakeMux implements MultiplexerPort {
  killed: string[] = [];
  constructor(
    readonly available: boolean,
    private live: string[] = [],
  ) {}
  wrap(name: string, spec: LaunchSpec): LaunchSpec {
    return this.available ? { ...spec, command: 'tmux', args: [name, spec.command] } : spec;
  }
  attach(name: string, spec: LaunchSpec): LaunchSpec {
    return { ...spec, command: 'tmux', args: ['attach', name] };
  }
  list(): Promise<string[]> {
    return Promise.resolve(this.live);
  }
  capture(): Promise<Uint8Array | null> {
    return Promise.resolve(null);
  }
  kill(name: string): Promise<void> {
    this.killed.push(name);
    return Promise.resolve();
  }
}

export class FakeStore implements SessionStorePort {
  saved: Session[] = [];
  constructor(private initial: Session[] = []) {}
  load(): Promise<Session[]> {
    return Promise.resolve(this.initial);
  }
  save(sessions: Session[]): Promise<void> {
    this.saved = sessions;
    return Promise.resolve();
  }
}

export class FakeSystem implements SystemPort {
  private counter = 0;
  constructor(private readonly dirs: readonly string[] = ['/work', '/other']) {}
  isDirectory(path: string): Promise<boolean> {
    return Promise.resolve(this.dirs.includes(path));
  }
  isPortFree(): Promise<boolean> {
    return Promise.resolve(true);
  }
  newId(): string {
    this.counter += 1;
    return `s${this.counter}`;
  }
  now(): Date {
    return new Date('2026-01-01T00:00:00.000Z');
  }
}
