import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { ProviderDefSchema, type ProviderDef } from './schema.js';

const FileSchema = z.looseObject({
  providers: z.array(z.looseObject({ id: z.string() })).default([]),
});
const KEY_VAR = { claude: 'ANTHROPIC_API_KEY', codex: 'OPENAI_API_KEY' } as const;

export interface ProfileRequest {
  id: string;
  base: 'claude' | 'codex';
  label: string | null;
  keyEnv: string | null;
}

/** Adds (or replaces) a profile in config.json, keeping every other setting untouched. */
export async function saveProfile(
  configDir: string,
  request: ProfileRequest,
): Promise<ProviderDef> {
  const file = join(configDir, 'config.json');
  const raw: unknown = await readFile(file, 'utf8').then(
    (text): unknown => JSON.parse(text),
    () => ({}),
  );
  const config = FileSchema.parse(raw);
  const entry = {
    id: request.id,
    label: request.label ?? request.id,
    base: request.base,
    ...(request.keyEnv ? { envFromHost: { [KEY_VAR[request.base]]: request.keyEnv } } : {}),
  };
  const providers = [...config.providers.filter((p) => p.id !== request.id), entry];
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify({ ...config, providers }, null, 2)}\n`, { mode: 0o600 });
  return ProviderDefSchema.parse(entry);
}
