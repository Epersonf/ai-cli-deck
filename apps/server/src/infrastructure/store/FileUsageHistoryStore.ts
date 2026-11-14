import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { UsageHistorySchema, type UsageHistory } from '@deck/shared';
import type { UsageHistoryStore } from '../../application/UsageHistoryStore.js';

/** Bounded, private turn metrics, never inserted into the model's prompt. */
export class FileUsageHistoryStore implements UsageHistoryStore {
  constructor(private readonly dir: string) {}

  private path(id: string): string {
    return join(this.dir, `${createHash('sha256').update(id).digest('hex')}.json`);
  }

  read(id: string): UsageHistory | null {
    try {
      return UsageHistorySchema.parse(JSON.parse(readFileSync(this.path(id), 'utf8')));
    } catch {
      return null;
    }
  }

  write(id: string, history: UsageHistory | null): void {
    if (!history) return this.remove(id);
    mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    const path = this.path(id);
    const tmp = `${path}.${randomUUID()}.tmp`;
    try {
      writeFileSync(tmp, JSON.stringify(history), { mode: 0o600 });
      renameSync(tmp, path);
    } finally {
      rmSync(tmp, { force: true });
    }
  }

  remove(id: string): void {
    rmSync(this.path(id), { force: true });
  }
}
