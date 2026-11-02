import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { SessionSchema, type Session } from '@deck/shared';
import { z } from 'zod';
import type { SessionStorePort } from '../../domain/ports.js';

const FileSchema = z.array(SessionSchema);

export class JsonSessionStore implements SessionStorePort {
  constructor(private readonly file: string) {}

  async load(): Promise<Session[]> {
    try {
      return FileSchema.parse(JSON.parse(await readFile(this.file, 'utf8')));
    } catch {
      return [];
    }
  }

  async save(sessions: Session[]): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, JSON.stringify(sessions, null, 2), { mode: 0o600 });
    await rename(tmp, this.file);
  }
}
