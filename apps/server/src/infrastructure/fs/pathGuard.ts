import { realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { forbidden, invalid, notFound } from '../../domain/errors.js';

const isWithin = (root: string, target: string): boolean =>
  target === root || target.startsWith(root.endsWith(sep) ? root : root + sep);

/**
 * The single guard for every file operation: rejects traversal, absolute paths and
 * symlinks that resolve outside `root`. Returns the real, verified path.
 */
export async function resolveInside(root: string, relative: string): Promise<string> {
  if (relative.includes('\0')) throw invalid('Invalid path');
  const realRoot = await realpath(root);
  const candidate = resolve(realRoot, relative === '' ? '.' : relative);
  if (!isWithin(realRoot, candidate)) throw forbidden('Path escapes the session folder');
  let real: string;
  try {
    real = await realpath(candidate);
  } catch {
    throw notFound(`Path ${relative}`);
  }
  if (!isWithin(realRoot, real)) throw forbidden('Path escapes the session folder');
  return real;
}

/**
 * For browsing and reading only: the path may go above `root` (`..`), so the explorer can climb out of the
 * session folder. Writes (delete, upload) keep using `resolveInside`.
 */
export async function resolveBrowse(root: string, relative: string): Promise<string> {
  if (relative.includes('\0')) throw invalid('Invalid path');
  const candidate = resolve(await realpath(root), relative === '' ? '.' : relative);
  try {
    return await realpath(candidate);
  } catch {
    throw notFound(`Path ${relative}`);
  }
}
