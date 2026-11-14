import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Limit, LimitStore } from '../../application/LimitBook.js';

/** The accounts' last usage windows, in one small JSON file. */
export class JsonLimitStore implements LimitStore {
  private queue: Promise<void> = Promise.resolve();
  constructor(private readonly path: string) {}

  async load(): Promise<Record<string, unknown>> {
    await this.queue;
    try {
      return JSON.parse(await readFile(this.path, 'utf8')) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  save(all: Record<string, Limit[]>): Promise<void> {
    const run = this.queue.then(async () => {
      await mkdir(dirname(this.path), { recursive: true });
      const tmp = `${this.path}.tmp`;
      await writeFile(tmp, JSON.stringify(all), { mode: 0o600 });
      await rename(tmp, this.path);
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}
