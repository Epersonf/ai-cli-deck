import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { SessionSchema, type Session } from '@deck/shared';
import { z } from 'zod';
import type { SessionStorePort } from '../../domain/ports.js';

const FileSchema = z.array(SessionSchema);

export class JsonSessionStore implements SessionStorePort {
  /** Saves run one after another: two at once would race on the same temporary file. */
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly file: string) {}

  async load(): Promise<Session[]> {
    try {
      return FileSchema.parse(JSON.parse(await readFile(this.file, 'utf8')));
    } catch {
      return [];
    }
  }

  save(sessions: Session[]): Promise<void> {
    const run = this.queue.then(() => this.write(sessions));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async write(sessions: Session[]): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, JSON.stringify(sessions, null, 2), { mode: 0o600 });
    await rename(tmp, this.file);
  }
}
