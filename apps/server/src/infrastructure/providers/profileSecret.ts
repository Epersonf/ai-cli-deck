import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const KEY_FILE = '.deck-key';

const read = (path: string): string => readFileSync(path, 'utf8').trim();

/** The API key of a profile: one small file in its own folder (mode 0600), never sent to the browser. */
export async function writeSecret(home: string, secret: string): Promise<void> {
  await writeFile(join(home, KEY_FILE), `${secret.trim()}\n`, { mode: 0o600 });
}

/** The saved key, or '' when there is none. */
export function readSecret(home: string): string {
  try {
    return read(join(home, KEY_FILE));
  } catch {
    return '';
  }
}

/** Claude Code's own settings may hold a key saved by an older version of the deck. */
export function readLegacyKey(home: string, env: string): string {
  try {
    const settings: unknown = JSON.parse(read(join(home, 'settings.json')));
    const value = (settings as { env?: Record<string, unknown> }).env?.[env];
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}
