import { createReadStream } from 'node:fs';
import { lstat, readdir } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { Readable } from 'node:stream';
import { crc32, createDeflateRaw } from 'node:zlib';

export interface ZipEntry {
  /** Absolute path on disk. */
  path: string;
  /** Name inside the archive, always with forward slashes; a trailing slash marks a folder. */
  name: string;
  mtime: Date;
}

export const MAX_ZIP_ENTRIES = 50_000;
export const MAX_ENTRY_BYTES = 0xffff_fffe; // classic zip: no zip64
const SKIPPED = new Set(['node_modules', '.git']);

/** Every regular file and folder under `root` (no symlinks, no .git/node_modules). */
export async function collectEntries(root: string, prefix: string): Promise<ZipEntry[]> {
  const out: ZipEntry[] = [];
  const walk = async (dir: string, rel: string): Promise<void> => {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      if (SKIPPED.has(item.name) || item.isSymbolicLink()) continue;
      if (out.length >= MAX_ZIP_ENTRIES) throw new Error('Folder has too many files to zip');
      const path = join(dir, item.name);
      const name = posix.join(rel, item.name);
      const info = await lstat(path);
      if (item.isDirectory()) {
        out.push({ path, name: `${name}/`, mtime: info.mtime });
        await walk(path, name);
      } else if (item.isFile()) {
        if (info.size > MAX_ENTRY_BYTES) continue;
        out.push({ path, name, mtime: info.mtime });
      }
    }
  };
  await walk(root, prefix);
  return out;
}

function dosTime(date: Date): { time: number; day: number } {
  const year = Math.max(date.getFullYear(), 1980);
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

interface Done {
  entry: ZipEntry;
  offset: number;
  crc: number;
  compressed: number;
  size: number;
  isDir: boolean;
}

function localHeader(entry: ZipEntry, isDir: boolean): Buffer {
  const name = Buffer.from(entry.name, 'utf8');
  const { time, day } = dosTime(entry.mtime);
  const h = Buffer.alloc(30 + name.length);
  h.writeUInt32LE(0x04034b50, 0);
  h.writeUInt16LE(20, 4);
  h.writeUInt16LE(isDir ? 0x0800 : 0x0808, 6); // utf-8 names (+ sizes in a trailing descriptor)
  h.writeUInt16LE(isDir ? 0 : 8, 8);
  h.writeUInt16LE(time, 10);
  h.writeUInt16LE(day, 12);
  h.writeUInt16LE(name.length, 26);
  name.copy(h, 30);
  return h;
}

function centralRecord(d: Done): Buffer {
  const name = Buffer.from(d.entry.name, 'utf8');
  const { time, day } = dosTime(d.entry.mtime);
  const c = Buffer.alloc(46 + name.length);
  c.writeUInt32LE(0x02014b50, 0);
  c.writeUInt16LE(20, 4);
  c.writeUInt16LE(20, 6);
  c.writeUInt16LE(d.isDir ? 0x0800 : 0x0808, 8);
  c.writeUInt16LE(d.isDir ? 0 : 8, 10);
  c.writeUInt16LE(time, 12);
  c.writeUInt16LE(day, 14);
  c.writeUInt32LE(d.crc, 16);
  c.writeUInt32LE(d.compressed, 20);
  c.writeUInt32LE(d.size, 24);
  c.writeUInt16LE(name.length, 28);
  c.writeUInt32LE(d.isDir ? 0x10 : 0, 38);
  c.writeUInt32LE(d.offset, 42);
  name.copy(c, 46);
  return c;
}

async function* fileBody(entry: ZipEntry, done: Done): AsyncGenerator<Buffer> {
  const deflate = createDeflateRaw();
  createReadStream(entry.path)
    .on('data', (chunk) => {
      const buf = chunk as Buffer;
      done.crc = crc32(buf, done.crc);
      done.size += buf.length;
      deflate.write(buf);
    })
    .on('end', () => deflate.end())
    .on('error', (error) => deflate.destroy(error));
  for await (const chunk of deflate) {
    done.compressed += (chunk as Buffer).length;
    yield chunk as Buffer;
  }
}

/** Streams a zip (deflate, data descriptors) of `entries`; memory stays flat for any size. */
export function zipStream(entries: readonly ZipEntry[]): Readable {
  async function* generate(): AsyncGenerator<Buffer> {
    const finished: Done[] = [];
    let offset = 0;
    const emit = (buf: Buffer): Buffer => ((offset += buf.length), buf);
    for (const entry of entries) {
      const isDir = entry.name.endsWith('/');
      const done: Done = { entry, offset, crc: 0, compressed: 0, size: 0, isDir };
      yield emit(localHeader(entry, isDir));
      if (!isDir) {
        for await (const chunk of fileBody(entry, done)) yield emit(chunk);
        const d = Buffer.alloc(16);
        d.writeUInt32LE(0x08074b50, 0);
        d.writeUInt32LE(done.crc, 4);
        d.writeUInt32LE(done.compressed, 8);
        d.writeUInt32LE(done.size, 12);
        yield emit(d);
      }
      finished.push(done);
    }
    const start = offset;
    for (const d of finished) yield emit(centralRecord(d));
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(finished.length, 8);
    end.writeUInt16LE(finished.length, 10);
    end.writeUInt32LE(offset - start, 12);
    end.writeUInt32LE(start, 16);
    yield end;
  }
  return Readable.from(generate());
}
