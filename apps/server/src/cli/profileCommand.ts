import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { PROFILE_BASES } from '../infrastructure/config/schema.js';

const FileSchema = z.object({ providers: z.array(z.looseObject({ id: z.string() })).default([]) });

export interface ProfileRequest {
  id: string;
  base: (typeof PROFILE_BASES)[number];
  label: string | null;
  keyEnv: string | null;
}

/** Parses `<id> <claude|codex> [--label "..."] [--key-env VAR]`. */
export function parseProfileArgs(args: readonly string[]): ProfileRequest | string {
  const [id, base] = args;
  const known = PROFILE_BASES.find((b) => b === base);
  if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id) || !known)
    return `usage: clideck profile add <id> <${PROFILE_BASES.join('|')}> [--label "Name"] [--key-env HOST_VAR]`;
  const after = (flag: string): string | null => args[args.indexOf(flag) + 1] ?? null;
  const flagged = (flag: string): string | null => (args.includes(flag) ? after(flag) : null);
  return { id, base: known, label: flagged('--label'), keyEnv: flagged('--key-env') };
}

const KEY_VAR = { claude: 'ANTHROPIC_API_KEY', codex: 'OPENAI_API_KEY' } as const;

/** Adds (or replaces) a profile entry in config.json; the server reads it on next start. */
export async function addProfile(request: ProfileRequest, env = process.env): Promise<string> {
  const dir = env['DECK_CONFIG_DIR'] ?? join(homedir(), '.config', 'ai-cli-deck');
  const file = join(dir, 'config.json');
  const raw: unknown = await readFile(file, 'utf8').then(
    (text): unknown => JSON.parse(text),
    () => ({}),
  );
  const config = z.looseObject({}).parse(raw);
  const { providers } = FileSchema.parse(config);
  const entry = {
    id: request.id,
    label: request.label ?? request.id,
    base: request.base,
    ...(request.keyEnv ? { envFromHost: { [KEY_VAR[request.base]]: request.keyEnv } } : {}),
  };
  const next = { ...config, providers: [...providers.filter((p) => p.id !== request.id), entry] };
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  const login = request.keyEnv ? `key from $${request.keyEnv}` : 'sign in with the CLI itself';
  return `Profile "${request.id}" saved (${login}). Restart the deck to use it.`;
}
