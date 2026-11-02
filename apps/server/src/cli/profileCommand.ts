import { homedir } from 'node:os';
import { join } from 'node:path';
import { PROFILE_BASES, profileIdFor, ProfileBaseSchema, type Profile } from '@deck/shared';
import { JsonProfileStore } from '../infrastructure/store/JsonProfileStore.js';

export interface ProfileRequest {
  label: string;
  base: Profile['base'];
  command: string;
}

const USAGE = `usage: clideck profile add "<name>" <${PROFILE_BASES.join('|')}> [--command <program>]`;

/** Parses `"<name>" <base> [--command program]`. */
export function parseProfileArgs(args: readonly string[]): ProfileRequest | string {
  const [label, base] = args;
  const parsed = ProfileBaseSchema.safeParse(base);
  if (!label?.trim() || !parsed.success) return USAGE;
  const at = args.indexOf('--command');
  return { label: label.trim(), base: parsed.data, command: at >= 0 ? (args[at + 1] ?? '') : '' };
}

/** Saves a clean profile; a running deck picks it up on next start (the UI adds it live). */
export async function addProfile(request: ProfileRequest, env = process.env): Promise<string> {
  const dir = env['DECK_CONFIG_DIR'] ?? join(homedir(), '.config', 'ai-cli-deck');
  const store = new JsonProfileStore(join(dir, 'profiles.json'));
  const all = await store.load();
  const id = profileIdFor(
    request.label,
    all.map((p) => p.id),
  );
  await store.save([...all, { ...request, id }]);
  return `Profile "${request.label}" (${id}) saved: a clean terminal, no login linked. Restart the deck to use it.`;
}
