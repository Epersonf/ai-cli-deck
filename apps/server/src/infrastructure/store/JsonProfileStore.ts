import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ProfileSchema, type Profile } from '@deck/shared';
import { z } from 'zod';
import type { ProfileStorePort } from '../../domain/ports.js';

const FileSchema = z.array(ProfileSchema);

/** Profiles created in the UI (or `clideck profile add`) live in their own file. */
export class JsonProfileStore implements ProfileStorePort {
  constructor(private readonly file: string) {}

  async load(): Promise<Profile[]> {
    try {
      return FileSchema.parse(JSON.parse(await readFile(this.file, 'utf8')));
    } catch {
      return [];
    }
  }

  async save(profiles: Profile[]): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, JSON.stringify(profiles, null, 2), { mode: 0o600 });
    await rename(tmp, this.file);
  }
}
