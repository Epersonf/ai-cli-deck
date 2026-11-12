import { call, type Env } from './client.js';

export const MEMORY_USAGE = `usage: clideck memory list [--scope global|profile] [--profile <other>]
       clideck memory read <id>
       clideck memory write --title "<title>" --body "<text>" [--folder "Work/Notes"] [--scope profile|global]
       clideck memory delete <id>
       clideck memory profiles
       clideck memory import --from <profile> [--ids a,b] [--folders x,y]`;

const show = (value: unknown): string => JSON.stringify(value, null, 2);
const csv = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v !== '');

/** `--flag value` pairs of the words; the rest stays in order. */
function flagsOf(words: readonly string[]): { rest: string[]; flags: Map<string, string> } {
  const flags = new Map<string, string>();
  const rest: string[] = [];
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i] ?? '';
    if (word.startsWith('--')) flags.set(word, words[(i += 1)] ?? '');
    else rest.push(word);
  }
  return { rest, flags };
}

/** `clideck memory ...`: the deck's notes for every chat and for this profile. */
export async function memoryCommand(deck: Env, words: readonly string[]): Promise<string> {
  const [action = 'list', ...args] = words;
  const { rest, flags } = flagsOf(args);
  const id = encodeURIComponent(rest[0] ?? '');
  switch (action) {
    case 'profiles':
      return show(await call(deck, 'GET', '/memory/profiles'));
    case 'read':
      if (!rest[0]) throw new Error(MEMORY_USAGE);
      return show(await call(deck, 'GET', `/memory/${id}`));
    case 'delete':
      if (!rest[0]) throw new Error(MEMORY_USAGE);
      return show(await call(deck, 'DELETE', `/memory/${id}`));
    case 'write': {
      const title = flags.get('--title');
      if (!title) throw new Error(MEMORY_USAGE);
      const body = {
        title,
        body: flags.get('--body') ?? '',
        folder: flags.get('--folder'),
        scope: flags.get('--scope'),
      };
      return show(await call(deck, 'POST', '/memory', body));
    }
    case 'import': {
      const fromProfile = flags.get('--from');
      if (!fromProfile) throw new Error(MEMORY_USAGE);
      const body = {
        fromProfile,
        ids: csv(flags.get('--ids')),
        folderIds: csv(flags.get('--folders')),
      };
      return show(await call(deck, 'POST', '/memory/import', body));
    }
    case 'list': {
      const query = new URLSearchParams();
      if (flags.get('--scope')) query.set('scope', flags.get('--scope') ?? '');
      if (flags.get('--profile')) query.set('profile', flags.get('--profile') ?? '');
      const text = query.toString();
      return show(await call(deck, 'GET', `/memory${text ? `?${text}` : ''}`));
    }
    default:
      throw new Error(MEMORY_USAGE);
  }
}
