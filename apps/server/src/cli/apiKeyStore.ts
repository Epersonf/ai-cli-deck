import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ApiKeyName } from '@deck/shared';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

async function readConfig(file: string): Promise<Record<string, unknown>> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    return {};
  }
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) throw new Error(`${file} must contain a JSON object`);
  return parsed;
}

/** Merges one API key into config.json (mode 0600) and keeps every other setting. */
export async function saveApiKey(
  configDir: string,
  name: ApiKeyName,
  key: string,
): Promise<string> {
  const file = join(configDir, 'config.json');
  const current = await readConfig(file);
  const keys = isRecord(current['apiKeys']) ? current['apiKeys'] : {};
  const next = { ...current, apiKeys: { ...keys, [name]: key } };
  await mkdir(configDir, { recursive: true, mode: 0o700 });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
  await rename(tmp, file);
  await chmod(file, 0o600);
  return file;
}
