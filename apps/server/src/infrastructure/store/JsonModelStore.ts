import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import type { ModelState, ModelStore } from '../../application/ModelBook.js';

const FileSchema = z.object({
  defaults: z.record(z.string(), z.string()).default({}),
  effective: z.record(z.string(), z.string()).default({}),
  modes: z.record(z.string(), z.string()).default({}),
});

/** The default and last-answering model of each provider, in one small JSON file. */
export class JsonModelStore implements ModelStore {
  constructor(private readonly path: string) {}

  async load(): Promise<ModelState> {
    try {
      return FileSchema.parse(JSON.parse(await readFile(this.path, 'utf8')));
    } catch {
      return { defaults: {}, effective: {}, modes: {} };
    }
  }

  async save(state: ModelState): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    await writeFile(tmp, JSON.stringify(state, null, 2));
    await rename(tmp, this.path);
  }
}
