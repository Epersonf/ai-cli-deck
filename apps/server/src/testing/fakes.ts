import type { ChatEntry, ChatFilesPort, ChatReader, ChatTurn } from '../domain/chat.js';
import type { Session } from '@deck/shared';
import type { ScrollbackStorePort, SessionStorePort, SystemPort } from '../domain/ports.js';

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

/** Chat notes in memory: what CLIs reported, and the transcripts written for another AI. */
export class FakeChatFiles implements ChatFilesPort {
  readonly reports = new Map<string, { id: string; path: string }>();
  readonly transcripts = new Map<string, string>();
  reportFile(id: string): string {
    return `/reports/${id}.json`;
  }
  reported(id: string) {
    return Promise.resolve(this.reports.get(id) ?? null);
  }
  forget(id: string): Promise<void> {
    this.reports.delete(id);
    return Promise.resolve();
  }
  writeTranscript(cwd: string, name: string, text: string): Promise<string> {
    const relative = `.deck/chats/${name}`;
    this.transcripts.set(`${cwd}/${relative}`, text);
    return Promise.resolve(relative);
  }
}

/** A CLI's chat files in memory: `chats` is what it lists, `turns` what each one says. */
export class FakeChatReader implements ChatReader {
  chats: ChatEntry[] = [];
  readonly turns = new Map<string, ChatTurn[]>();
  list(): Promise<ChatEntry[]> {
    return Promise.resolve(
      [...this.chats].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    );
  }
  read(entry: ChatEntry): Promise<ChatTurn[]> {
    return Promise.resolve(this.turns.get(entry.id) ?? []);
  }
}
