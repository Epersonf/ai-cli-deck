import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import type { AuthStorePort, StoredAuth } from '../../domain/auth.js';

const StoredAuthSchema = z.object({
  password: z
    .union([
      z.object({ kind: z.literal('password'), salt: z.string(), hash: z.string() }),
      z.object({ kind: z.literal('none') }),
    ])
    .nullable(),
  token: z.string().min(16),
});

/** Credentials live outside the repo, mode 0600, and are never sent to the browser. */
export class JsonAuthStore implements AuthStorePort {
  constructor(private readonly file: string) {}

  async load(): Promise<StoredAuth | null> {
    try {
      return StoredAuthSchema.parse(JSON.parse(await readFile(this.file, 'utf8')));
    } catch {
      return null;
    }
  }

  async save(auth: StoredAuth): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, JSON.stringify(auth, null, 2), { mode: 0o600 });
    await rename(tmp, this.file);
  }
}
