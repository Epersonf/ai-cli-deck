import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import type { NetworkState, NetworkStorePort } from '../../domain/network.js';

const FileSchema = z.object({
  sharing: z.boolean().default(false),
  name: z.string().nullable().default(null),
  peers: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        key: z.string(),
        addresses: z.array(z.string()).default([]),
        pairedAt: z.string(),
        lastSeen: z.string().nullable().default(null),
      }),
    )
    .default([]),
});

/** Sharing setting and paired decks (`network.json`, private to the user). */
export class JsonNetworkStore implements NetworkStorePort {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly file: string) {}

  async load(): Promise<NetworkState> {
    try {
      return FileSchema.parse(JSON.parse(await readFile(this.file, 'utf8')));
    } catch {
      return FileSchema.parse({});
    }
  }

  /** Saves one after another: two quick changes never race on the temporary file. */
  save(state: NetworkState): Promise<void> {
    const next = this.queue.then(() => this.write(state));
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async write(state: NetworkState): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
    await rename(tmp, this.file);
  }
}
