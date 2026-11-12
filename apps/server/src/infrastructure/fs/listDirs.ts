import { existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import type { FsDirs } from '@deck/shared';
import { invalid, notFound } from '../../domain/errors.js';

const MAX_DIRS = 500;
const SEP = String.fromCharCode(92);

type Entry = { name: string; path: string };

/** Drives that exist on Windows, `/` elsewhere. */
function roots(): Entry[] {
  if (process.platform !== 'win32') return [{ name: '/', path: '/' }];
  const found: Entry[] = [];
  for (let code = 65; code <= 90; code += 1) {
    const letter = String.fromCharCode(code);
    if (existsSync(letter + ':' + SEP))
      found.push({ name: letter + ':', path: letter + ':' + SEP });
  }
  return found;
}

/** `~` and `~/x` mean the home folder; anything else must be absolute. */
function resolveInput(input: string, home: string): string {
  if (input.includes('\0')) throw invalid('Invalid path');
  const wanted = input.trim();
  if (wanted === '') return home;
  if (wanted === '~') return home;
  if (wanted.startsWith('~/') || wanted.startsWith('~' + SEP))
    return resolve(home, wanted.slice(2));
  if (!isAbsolute(wanted)) throw invalid('The path must be absolute');
  return resolve(wanted);
}

/** Whether a directory entry is a folder (a link to one counts), without failing on unreadable ones. */
async function isFolder(parent: string, name: string, kind: boolean | null): Promise<boolean> {
  if (kind === true) return true;
  if (kind === false) return false;
  return stat(join(parent, name)).then(
    (info) => info.isDirectory(),
    () => false,
  );
}

/** The sub-folders of a folder, for the folder picker (hidden ones last, at most 500). */
export async function listDirs(input: string, home = homedir()): Promise<FsDirs> {
  const path = resolveInput(input, home);
  const info = await stat(path).catch(() => null);
  if (!info) throw notFound(`Folder ${path}`);
  if (!info.isDirectory()) throw invalid('That is not a folder');
  const entries = await readdir(path, { withFileTypes: true }).catch(() => []);
  const dirs: Entry[] = [];
  for (const entry of entries) {
    const link = entry.isSymbolicLink();
    const folder = await isFolder(path, entry.name, link ? null : entry.isDirectory());
    if (folder) dirs.push({ name: entry.name, path: join(path, entry.name) });
  }
  const hidden = (e: Entry): number => (e.name.startsWith('.') ? 1 : 0);
  dirs.sort((a, b) => hidden(a) - hidden(b) || a.name.localeCompare(b.name));
  const up = dirname(path);
  return {
    path,
    parent: up === path || path === sep ? null : up,
    home,
    roots: roots(),
    dirs: dirs.slice(0, MAX_DIRS),
  };
}
