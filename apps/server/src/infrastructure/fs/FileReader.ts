import { open, readdir, stat } from 'node:fs/promises';
import { posix } from 'node:path';
import type { FileContent } from '@deck/shared';
import { invalid } from '../../domain/errors.js';
import type { FilesPort, RawFileEntry } from '../../domain/ports.js';
import { resolveInside } from './pathGuard.js';

const BINARY_SNIFF_BYTES = 8000;

async function kindOf(root: string, relative: string, isDir: boolean, isLink: boolean) {
  if (!isLink) return isDir ? 'dir' : 'file';
  try {
    const real = await resolveInside(root, relative);
    return (await stat(real)).isDirectory() ? 'dir' : 'file';
  } catch {
    return null;
  }
}

export class FileReader implements FilesPort {
  async list(root: string, relative: string): Promise<RawFileEntry[]> {
    const dir = await resolveInside(root, relative);
    const dirents = await readdir(dir, { withFileTypes: true });
    const entries: RawFileEntry[] = [];
    for (const dirent of dirents) {
      const path = posix.join(relative, dirent.name);
      const kind = await kindOf(root, path, dirent.isDirectory(), dirent.isSymbolicLink());
      if (kind !== null) entries.push({ name: dirent.name, path, kind });
    }
    return entries;
  }

  async resolveFile(root: string, relative: string): Promise<{ path: string; size: number }> {
    const real = await resolveInside(root, relative);
    const info = await stat(real);
    if (!info.isFile()) throw invalid('Path is not a file');
    return { path: real, size: info.size };
  }

  async read(root: string, relative: string, maxBytes: number): Promise<FileContent> {
    const real = await resolveInside(root, relative);
    const info = await stat(real);
    if (info.isDirectory()) throw invalid('Path is a directory');
    const handle = await open(real, 'r');
    try {
      const buffer = Buffer.alloc(Math.min(info.size, maxBytes));
      await handle.read(buffer, 0, buffer.length, 0);
      const binary = buffer.subarray(0, BINARY_SNIFF_BYTES).includes(0);
      const content = binary ? '' : buffer.toString('utf8');
      return { path: relative, content, size: info.size, truncated: info.size > maxBytes, binary };
    } finally {
      await handle.close();
    }
  }
}
