import type { Session } from '@deck/shared';
import type {
  HandoffStorePort,
  ScrollbackStorePort,
  SessionStorePort,
  SystemPort,
} from '../domain/ports.js';

export { FakeMux, FakePty, FakePtyPort } from './fakeTerminal.js';

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

export class FakeScrollback implements ScrollbackStorePort {
  readonly files = new Map<string, Uint8Array>();
  load(id: string): Promise<Uint8Array | null> {
    return Promise.resolve(this.files.get(id) ?? null);
  }
  save(id: string, data: Uint8Array): Promise<void> {
    this.files.set(id, data);
    return Promise.resolve();
  }
  remove(id: string): Promise<void> {
    this.files.delete(id);
    return Promise.resolve();
  }
}

export class FakeSystem implements SystemPort {
  private counter = 0;
  constructor(private readonly dirs: readonly string[] = ['/work', '/other']) {}
  homeDir(): string {
    return '/home/test';
  }
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

export class FakeHandoffs implements HandoffStorePort {
  readonly files = new Map<string, { text: string; updatedAt: string }>();
  private clock = 0;
  pathOf(id: string): string {
    return `/handoffs/${id}.md`;
  }
  write(id: string, text: string): Promise<void> {
    this.files.set(id, {
      text,
      updatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, ++this.clock)).toISOString(),
    });
    return Promise.resolve();
  }
  info(id: string) {
    const file = this.files.get(id);
    return Promise.resolve(file ? { updatedAt: file.updatedAt, bytes: file.text.length } : null);
  }
  remove(id: string): Promise<void> {
    this.files.delete(id);
    return Promise.resolve();
  }
}
