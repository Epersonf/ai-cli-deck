import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { createHash, type Hash } from 'node:crypto';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Asset } from './assets.js';

export interface DownloadOptions {
  onBytes?: (got: number) => void;
  get?: typeof fetch;
  /** A transfer with no data for this long is given up on (then tried again from where it got to). */
  stallMs?: number;
  tries?: number;
}

class Mismatch extends Error {}

const sizeOf = (path: string): Promise<number> =>
  stat(path).then(
    (info) => info.size,
    () => 0,
  );

const hashFile = async (path: string, hash: Hash): Promise<void> => {
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
};

/** One try: continues the `.part` file when the server allows, hashing everything it holds. */
async function attempt(asset: Asset, tmp: string, hash: Hash, o: Required<DownloadOptions>) {
  const have = await sizeOf(tmp);
  const stop = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const watch = (): void => {
    clearTimeout(timer);
    timer = setTimeout(() => stop.abort(new Error('The download stalled.')), o.stallMs);
  };
  watch();
  try {
    if (have >= asset.size) return hashFile(tmp, hash); // all of it is already here
    const headers = have > 0 ? { range: `bytes=${have}-` } : undefined;
    const res = await o.get(asset.url, { signal: stop.signal, ...(headers && { headers }) });
    if (!res.ok || !res.body) throw new Error(`The download failed (HTTP ${res.status}).`);
    const resumed = have > 0 && res.status === 206;
    let got = resumed ? have : 0;
    if (resumed) await hashFile(tmp, hash);
    const source = Readable.fromWeb(res.body as never);
    source.on('data', (chunk: Buffer) => {
      watch();
      hash.update(chunk);
      got += chunk.length;
      o.onBytes(got);
    });
    const out = createWriteStream(tmp, { flags: resumed ? 'a' : 'w' });
    try {
      await pipeline(source, out, { signal: stop.signal });
    } catch (error) {
      // The file must be closed before the next try reads how far it got.
      if (!out.closed) await new Promise((resolve) => out.once('close', resolve));
      throw error;
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Downloads `asset` to `dest`, keeping it only if its sha256 is the pinned one. A transfer that stalls or
 * breaks is continued from the partial file; a file that does not match is thrown away.
 */
export async function downloadVerified(
  asset: Asset,
  dest: string,
  options: DownloadOptions | ((got: number) => void) = {},
): Promise<void> {
  const o: Required<DownloadOptions> = {
    onBytes: () => undefined,
    get: fetch,
    stallMs: 45_000,
    tries: 4,
    ...(typeof options === 'function' ? { onBytes: options } : options),
  };
  const tmp = `${dest}.part`;
  await mkdir(dirname(dest), { recursive: true });
  let failure: unknown = null;
  for (let n = 0; n < o.tries; n += 1) {
    const hash = createHash('sha256');
    try {
      await attempt(asset, tmp, hash, o);
      if (hash.digest('hex') !== asset.sha256)
        throw new Mismatch('The downloaded file does not match the expected sha256: discarded.');
      await rename(tmp, dest);
      return;
    } catch (error) {
      failure = error;
      if (error instanceof Mismatch) {
        await rm(tmp, { force: true });
        break;
      }
    }
  }
  throw failure instanceof Error ? failure : new Error(String(failure));
}
