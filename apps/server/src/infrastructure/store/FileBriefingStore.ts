import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BriefingSnapshot, BriefingStore } from '../../application/BriefingStore.js';

/** Small instruction snapshots, read once per session and written before launching its first turn. */
export class FileBriefingStore implements BriefingStore {
  constructor(private readonly dir: string) {}

  private path(id: string): string {
    return join(this.dir, `${createHash('sha256').update(id).digest('hex')}.json`);
  }

  read(id: string): BriefingSnapshot | null {
    try {
      const value = JSON.parse(readFileSync(this.path(id), 'utf8')) as Partial<BriefingSnapshot>;
      if (
        value.version !== 1 ||
        typeof value.provider !== 'string' ||
        typeof value.guide !== 'string'
      )
        return null;
      const hash = createHash('sha256').update(value.guide).digest('hex');
      return hash === value.hash ? (value as BriefingSnapshot) : null;
    } catch {
      return null;
    }
  }

  write(id: string, snapshot: BriefingSnapshot): void {
    mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    const path = this.path(id);
    const tmp = `${path}.${randomUUID()}.tmp`;
    try {
      writeFileSync(tmp, JSON.stringify(snapshot), { mode: 0o600 });
      renameSync(tmp, path);
    } finally {
      rmSync(tmp, { force: true });
    }
  }

  remove(id: string): void {
    rmSync(this.path(id), { force: true });
  }
}
