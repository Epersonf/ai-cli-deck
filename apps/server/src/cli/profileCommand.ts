import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  isHttpUrl,
  PROFILE_BASES,
  profileIdFor,
  ProfileBaseSchema,
  type Profile,
} from '@deck/shared';
import { JsonProfileStore } from '../infrastructure/store/JsonProfileStore.js';

export interface ProfileRequest {
  label: string;
  base: Profile['base'];
  command: string;
  baseUrl: string;
}

const USAGE = `usage: clideck profile add "<name>" <${PROFILE_BASES.join('|')}> [--command <program>] [--url <api-base-url>]`;

const optionValue = (args: readonly string[], flag: string): string => {
  const at = args.indexOf(flag);
  return at >= 0 ? (args[at + 1] ?? '') : '';
};

/** Parses `"<name>" <base> [--command program] [--url base-url]`. */
export function parseProfileArgs(args: readonly string[]): ProfileRequest | string {
  const [label, base] = args;
  const parsed = ProfileBaseSchema.safeParse(base);
  if (!label?.trim() || !parsed.success) return USAGE;
  const baseUrl = optionValue(args, '--url');
  if (parsed.data === 'claude-endpoint' && !isHttpUrl(baseUrl))
    return `claude-endpoint needs --url <api-base-url> (http:// or https://)
${USAGE}`;
  if (parsed.data !== 'claude-endpoint' && baseUrl !== '')
    return `--url only applies to claude-endpoint
${USAGE}`;
  return {
    label: label.trim(),
    base: parsed.data,
    command: optionValue(args, '--command'),
    baseUrl,
  };
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
