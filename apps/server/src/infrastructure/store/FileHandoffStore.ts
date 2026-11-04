import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { HandoffInfo } from '@deck/shared';
import type { HandoffStorePort } from '../../domain/ports.js';

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

/** One `<id>.md` file per session under `dir`: the notes an agent leaves for whoever continues its work. */
export class FileHandoffStore implements HandoffStorePort {
  constructor(private readonly dir: string) {}

  pathOf(id: string): string {
    return join(this.dir, `${id}.md`);
  }

  async write(id: string, text: string): Promise<void> {
    if (!SAFE_ID.test(id)) return;
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    await writeFile(this.pathOf(id), text, { mode: 0o600 });
  }

  async info(id: string): Promise<HandoffInfo | null> {
    if (!SAFE_ID.test(id)) return null;
    try {
      const file = await stat(this.pathOf(id));
      return { updatedAt: file.mtime.toISOString(), bytes: file.size };
    } catch {
      return null;
    }
  }

  async remove(id: string): Promise<void> {
    if (SAFE_ID.test(id)) await rm(this.pathOf(id), { force: true });
  }
}
