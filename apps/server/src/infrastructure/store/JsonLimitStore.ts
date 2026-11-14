import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Limit, LimitStore } from '../../application/LimitBook.js';

/** The accounts' last usage windows, in one small JSON file. */
export class JsonLimitStore implements LimitStore {
  constructor(private readonly path: string) {}

  async load(): Promise<Record<string, unknown>> {
    try {
      return JSON.parse(await readFile(this.path, 'utf8')) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  async save(all: Record<string, Limit[]>): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify(all));
  }
}
