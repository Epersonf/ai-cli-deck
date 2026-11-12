import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { MemoryTreeSchema, type MemoryTree } from '@deck/shared';
import type { MemoryStorePort } from '../../application/MemoryService.js';

/**
 * The notes as plain JSON the person can read and edit: `<dir>/global.json` and `<dir>/profiles/<id>.json`.
 * A file that is not valid is left alone and ignored (never overwritten with something empty by a read).
 */
export class JsonMemoryStore implements MemoryStorePort {
  constructor(private readonly dir: string) {}

  private file(key: string): string {
    return key === 'global'
      ? join(this.dir, 'global.json')
      : join(this.dir, 'profiles', `${key.slice('profile:'.length)}.json`);
  }

  private async read(path: string): Promise<MemoryTree | null> {
    try {
      const parsed = MemoryTreeSchema.safeParse(JSON.parse(await readFile(path, 'utf8')));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  async loadAll(): Promise<Record<string, MemoryTree>> {
    const all: Record<string, MemoryTree> = {};
    const global = await this.read(this.file('global'));
    if (global) all['global'] = global;
    const names = await readdir(join(this.dir, 'profiles')).catch(() => [] as string[]);
    for (const name of names.filter((n) => n.endsWith('.json'))) {
      const tree = await this.read(join(this.dir, 'profiles', name));
      if (tree) all[`profile:${name.slice(0, -'.json'.length)}`] = tree;
    }
    return all;
  }

  async save(key: string, tree: MemoryTree): Promise<void> {
    const path = this.file(key);
    await mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    await writeFile(tmp, JSON.stringify(tree, null, 2), { mode: 0o600 });
    await rename(tmp, path);
  }

  async remove(key: string): Promise<void> {
    await rm(this.file(key), { force: true });
  }
}
