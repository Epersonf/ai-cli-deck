import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { resolveCwd } from '../../application/cwd.js';
import { invalid, notFound } from '../../domain/errors.js';

/** A path as an agent writes it: `~/x`, absolute, or relative to the home folder. */
export function machinePath(input: string): string {
  const expanded = resolveCwd(input, homedir());
  return isAbsolute(expanded) ? resolve(expanded) : resolve(homedir(), expanded);
}

export interface Outgoing {
  kind: 'file' | 'dir';
  name: string;
  size: number | null;
  body: Readable;
}

/**
 * What a path holds, ready to stream: a file as its bytes, a folder as a tar archive of it (both ends have
 * `tar`: Linux, Android's Ubuntu and Windows 10+), so a whole output folder travels in one go.
 */
export async function readPath(input: string): Promise<Outgoing> {
  const path = machinePath(input);
  const info = await stat(path).catch(() => null);
  if (!info) throw notFound(`Path ${path}`);
  if (info.isFile())
    return { kind: 'file', name: basename(path), size: info.size, body: createReadStream(path) };
  if (!info.isDirectory()) throw invalid(`Not a file or folder: ${path}`);
  const tar = spawn('tar', ['-cf', '-', '-C', dirname(path), basename(path)], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return { kind: 'dir', name: basename(path), size: null, body: tar.stdout };
}

/**
 * Saves what arrives at `input`: a file there (or inside it, when it is a folder), or a folder unpacked into
 * it. Returns where it landed.
 */
export async function writePath(
  input: string,
  kind: 'file' | 'dir',
  name: string,
  body: Readable,
): Promise<string> {
  const path = machinePath(input);
  const info = await stat(path).catch(() => null);
  if (kind === 'dir') {
    if (info && !info.isDirectory()) throw invalid(`Not a folder: ${path}`);
    await mkdir(path, { recursive: true });
    const tar = spawn('tar', ['-xf', '-', '-C', path], { stdio: ['pipe', 'ignore', 'pipe'] });
    let error = '';
    tar.stderr.on('data', (chunk: Buffer) => (error += chunk.toString()));
    await pipeline(body, tar.stdin);
    const code = await new Promise<number | null>((done) => tar.on('close', done));
    if (code !== 0)
      throw invalid(`Could not unpack the folder: ${error.trim() || `tar exit ${code}`}`);
    return join(path, name);
  }
  const target = info?.isDirectory() ? join(path, basename(name)) : path;
  await mkdir(dirname(target), { recursive: true });
  await pipeline(body, createWriteStream(target));
  return target;
}
