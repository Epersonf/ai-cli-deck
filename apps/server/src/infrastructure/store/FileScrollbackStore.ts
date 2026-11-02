import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ScrollbackStorePort } from '../../domain/ports.js';

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

/** One `<id>.bin` file per session under `dir`; ids that are not plain tokens are ignored. */
export class FileScrollbackStore implements ScrollbackStorePort {
  constructor(private readonly dir: string) {}

  async load(id: string): Promise<Uint8Array | null> {
    if (!SAFE_ID.test(id)) return null;
    try {
      return await readFile(this.fileOf(id));
    } catch {
      return null;
    }
  }

  async save(id: string, data: Uint8Array): Promise<void> {
    if (!SAFE_ID.test(id)) return;
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    const tmp = `${this.fileOf(id)}.tmp`;
    await writeFile(tmp, data, { mode: 0o600 });
    await rename(tmp, this.fileOf(id));
  }

  async remove(id: string): Promise<void> {
    if (!SAFE_ID.test(id)) return;
    await rm(this.fileOf(id), { force: true });
  }

  private fileOf(id: string): string {
    return join(this.dir, `${id}.bin`);
  }
}
