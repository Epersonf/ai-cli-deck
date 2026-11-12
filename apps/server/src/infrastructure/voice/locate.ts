import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';

/** The first of `names` found as a file in PATH (with `.exe` on Windows), or null. */
export function locate(
  names: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  platform: NodeJS.Platform = process.platform,
  exists: (path: string) => boolean = existsSync,
): string | null {
  const dirs = (env['PATH'] ?? env['Path'] ?? '').split(delimiter).filter(Boolean);
  const suffix = platform === 'win32' ? '.exe' : '';
  for (const name of names) {
    for (const dir of dirs) {
      const file = join(dir, name + suffix);
      if (exists(file)) return file;
    }
  }
  return null;
}
