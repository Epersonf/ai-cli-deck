import { isAbsolute } from 'node:path';
import { invalid } from '../domain/errors.js';
import type { SystemPort } from '../domain/ports.js';

/** Expands a leading `~` to the home directory (works with / and \ separators). */
export function resolveCwd(input: string, home: string): string {
  const text = input.trim();
  if (text === '~') return home;
  if (/^~[\\/]/.test(text)) return home.replace(/[\\/]+$/, '') + text.slice(1);
  return text;
}

/** The folder `input` names (`~` allowed); it must exist, and be an absolute path when `absolute` is set. */
export async function existingDir(
  system: SystemPort,
  input: string,
  absolute: boolean,
): Promise<string> {
  const dir = resolveCwd(input, system.homeDir());
  if (absolute && !isAbsolute(dir)) throw invalid('Folder must be an absolute path');
  if (!(await system.isDirectory(dir))) throw invalid(`Not a directory: ${dir}`);
  return dir;
}
