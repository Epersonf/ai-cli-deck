import { normalizeUrl } from '@deck/shared';
import { parseEnsureKey, type EnsureKey } from './ensureKey.js';

export type Command =
  | { name: 'help' }
  | { name: 'whoami' }
  | { name: 'sessions' }
  | { name: 'port' }
  | { name: 'preview'; url: string }
  | { name: 'newtab'; url: string }
  | { name: 'title'; title: string | null }
  | { name: 'meta'; key: string | null; value: string | null }
  | { name: 'handoff'; text: string | null }
  | { name: 'task'; action: string; args: string[] }
  | { name: 'phone'; action: string; text: string; title: string; args: string[] }
  | { name: 'worktree'; reason: string }
  | { name: 'status'; requestId: string }
  | { name: 'install'; force: boolean }
  | { name: 'setup'; provider: string | null }
  | { name: 'profile'; args: string[] }
  | ({ name: 'ensure-key' } & EnsureKey);

const PHONE_USAGE =
  'usage: clideck phone battery | device | notify "<text>" [--title "<title>"] | wifi status|scan|on|off|connect "<ssid>" [--password P]';

function parseWifi(words: readonly string[]): Parsed {
  const [verb = 'status', ...args] = words;
  const known = ['status', 'scan', 'on', 'off', 'connect'];
  if (!known.includes(verb) || (verb === 'connect' && !args[0])) return fail(PHONE_USAGE);
  return ok({ name: 'phone', action: `wifi-${verb}`, text: '', title: '', args });
}

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
    case 'meta': {
      const [verb = 'list', key, ...value] = rest;
      if (verb === 'list') return ok({ name, key: null, value: null });
      if (verb === 'get' && key) return ok({ name, key, value: null });
      if (verb === 'set' && key) return ok({ name, key, value: value.join(' ') });
      if (verb === 'del' && key) return ok({ name, key, value: '' });
      return fail('usage: clideck meta [get <key> | set <key> "<value>" | del <key>]');
    }
    case 'task': {
      const [action = 'list', ...args] = rest;
      return ['run', 'battery', 'list', 'stop', 'log'].includes(action)
        ? ok({ name, action, args })
        : fail(
            'usage: clideck task run "<command>" [--name N] | battery [--below N] [--above N] [--text T] | list | stop <id> | log <id>',
          );
    }
    case 'phone': {
      const [action, ...words] = rest;
      const titleAt = words.indexOf('--title');
      const title = titleAt >= 0 ? (words[titleAt + 1] ?? '') : '';
      const message = (titleAt >= 0 ? words.slice(0, titleAt) : words).join(' ').trim();
      if (action === 'battery' || action === 'device')
        return ok({ name, action, text: '', title: '', args: [] });
      if (action === 'notify' && message !== '')
        return ok({ name, action, text: message, title, args: [] });
      if (action === 'wifi') return parseWifi(words);
      return fail(PHONE_USAGE);
    }
    case 'handoff':
      return ok({ name, text: text === '' ? null : text });
    case 'fork':
      return text === ''
        ? fail('usage: clideck fork "<arguments that fork this chat>"')
        : ok({ name: 'meta', key: 'fork', value: text });
    case 'resume':
      return text === ''
        ? fail('usage: clideck resume "<arguments that continue this chat>"')
        : ok({ name: 'meta', key: 'resume', value: text });
    case 'title':
      return ok({ name, title: text === '' ? null : text });
    case 'worktree':
      return text === '' ? fail('usage: clideck worktree "<reason>"') : ok({ name, reason: text });
    case 'status':
      return text === ''
        ? fail('usage: clideck status <requestId>')
        : ok({ name, requestId: text });
    case 'setup':
      return ok({ name, provider: rest[0] ?? null });
    case 'profile':
      return rest[0] === 'add'
        ? ok({ name, args: rest.slice(1) })
        : fail(
            'usage: clideck profile add "<name>" <template> [--<field> <value>]... (see clideck profile add with no template)',
          );
    case 'ensure-key': {
      const parsed = parseEnsureKey(rest);
      return typeof parsed === 'string' ? fail(parsed) : ok({ name, ...parsed });
    }
    case 'install':
      return ok({ name, force: rest.includes('--force') });
    default:
      return fail(`unknown command "${name}". Try: clideck help`);
  }
}
