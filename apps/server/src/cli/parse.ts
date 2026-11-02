import { normalizeUrl } from '@deck/shared';

export type Command =
  | { name: 'help' }
  | { name: 'whoami' }
  | { name: 'sessions' }
  | { name: 'port' }
  | { name: 'preview'; url: string }
  | { name: 'newtab'; url: string }
  | { name: 'worktree'; reason: string }
  | { name: 'status'; requestId: string }
  | { name: 'install'; force: boolean }
  | { name: 'setup'; provider: string | null };

export type Parsed = { ok: true; command: Command } | { ok: false; error: string };

const fail = (error: string): Parsed => ({ ok: false, error });
const ok = (command: Command): Parsed => ({ ok: true, command });

/** Parses `clideck ...` arguments (also tolerates a leading "/clideck" from slash commands). */
export function parseArgs(argv: readonly string[]): Parsed {
  const args = argv[0] === '/clideck' || argv[0] === 'clideck' ? argv.slice(1) : [...argv];
  const [name = 'help', ...rest] = args;
  const text = rest.join(' ').trim();
  switch (name) {
    case 'help':
    case '--help':
    case '-h':
      return ok({ name: 'help' });
    case 'whoami':
    case 'sessions':
    case 'port':
      return ok({ name });
    case 'preview':
    case 'newtab':
      return text === ''
        ? fail(`usage: clideck ${name} <url|port>`)
        : ok({ name, url: normalizeUrl(text) });
    case 'worktree':
      return text === '' ? fail('usage: clideck worktree "<reason>"') : ok({ name, reason: text });
    case 'status':
      return text === ''
        ? fail('usage: clideck status <requestId>')
        : ok({ name, requestId: text });
    case 'setup':
      return ok({ name, provider: rest[0] ?? null });
    case 'install':
      return ok({ name, force: rest.includes('--force') });
    default:
      return fail(`unknown command "${name}". Try: clideck help`);
  }
}
