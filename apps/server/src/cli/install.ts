import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { SLASH_FILES } from './slashCommands.js';

const exists = (path: string): Promise<boolean> =>
  stat(path).then(
    () => true,
    () => false,
  );

/** Writes the slash command files under `home`; existing files are kept unless `force`. */
export async function installSlashCommands(home: string, force: boolean): Promise<string[]> {
  const lines: string[] = [];
  for (const file of SLASH_FILES) {
    const target = join(home, file.path);
    if (!force && (await exists(target))) {
      lines.push(`kept     ${target} (use --force to overwrite)`);
      continue;
    }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content);
    lines.push(`wrote    ${target}`);
  }
  return lines;
}
