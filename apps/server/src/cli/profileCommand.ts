import { homedir } from 'node:os';
import { join } from 'node:path';
import { PROFILE_BASES } from '../infrastructure/config/schema.js';
import { saveProfile, type ProfileRequest } from '../infrastructure/config/profileStore.js';

export type { ProfileRequest };

/** Parses `<id> <claude|codex> [--label "..."] [--key-env VAR]`. */
export function parseProfileArgs(args: readonly string[]): ProfileRequest | string {
  const [id, base] = args;
  const known = PROFILE_BASES.find((b) => b === base);
  if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id) || !known)
    return `usage: clideck profile add <id> <${PROFILE_BASES.join('|')}> [--label "Name"] [--key-env HOST_VAR]`;
  const flagged = (flag: string): string | null =>
    args.includes(flag) ? (args[args.indexOf(flag) + 1] ?? null) : null;
  return { id, base: known, label: flagged('--label'), keyEnv: flagged('--key-env') };
}

/** Saves the profile to config.json; the server picks it up on next start (or via the UI). */
export async function addProfile(request: ProfileRequest, env = process.env): Promise<string> {
  const dir = env['DECK_CONFIG_DIR'] ?? join(homedir(), '.config', 'ai-cli-deck');
  await saveProfile(dir, request);
  const login = request.keyEnv ? `key from $${request.keyEnv}` : 'sign in with the CLI itself';
  return `Profile "${request.id}" saved (${login}). Restart the deck to use it.`;
}
