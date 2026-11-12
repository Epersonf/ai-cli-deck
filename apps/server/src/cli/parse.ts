import { normalizeUrl } from '@deck/shared';
import { DEVICE_USAGE } from './deviceCommand.js';

export type Command =
  | { name: 'help' }
  | { name: 'whoami' }
  | { name: 'sessions' }
  | { name: 'port' }
  | { name: 'preview'; url: string }
  | { name: 'newtab'; url: string }
  | { name: 'title'; title: string | null }
  | { name: 'meta'; key: string | null; value: string | null }
  | { name: 'task'; action: string; args: string[] }
  | { name: 'device'; args: string[] }
  | { name: 'memory'; args: string[] }
  | { name: 'phone'; action: string; text: string; title: string; args: string[] }
  | { name: 'worktree'; reason: string }
  | { name: 'folder'; path: string; reason: string }
  | { name: 'status'; requestId: string }
  | { name: 'install'; force: boolean }
  | { name: 'setup'; provider: string | null }
  | { name: 'profile'; args: string[] };

const PHONE_USAGE =
  'usage: clideck phone help | battery | device | notify "<text>" | wifi ... | <capability> [action] [--option value]  (clideck phone help lists what is enabled)';

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
      if (action === 'notify') return fail(PHONE_USAGE);
      if (action === 'help') return ok({ name, action: 'help', text: '', title: '', args: [] });
      // Anything else is a capability of the phone: `clideck phone sms send --to N --text T`.
      if (action && /^[a-z]+$/.test(action))
        return ok({ name, action: 'call', text: '', title: '', args: [action, ...words] });
      return fail(PHONE_USAGE);
    }
    case 'memory':
      return ok({ name, args: rest });
    case 'devices':
      return ok({ name: 'device', args: [] });
    case 'copy':
      return rest.length < 2
        ? fail(DEVICE_USAGE)
        : ok({ name: 'device', args: ['--copy', ...rest] });
    case 'device':
      return rest.length < 2 ? fail(DEVICE_USAGE) : ok({ name: 'device', args: rest });
    case 'title':
      return ok({ name, title: text === '' ? null : text });
    case 'worktree':
      return text === '' ? fail('usage: clideck worktree "<reason>"') : ok({ name, reason: text });
    case 'folder':
      return rest[0] === undefined
        ? fail('usage: clideck folder <path> ["<reason>"]')
        : ok({ name, path: rest[0], reason: rest.slice(1).join(' ') });
    case 'status':
      return text === ''
        ? fail('usage: clideck status <requestId>')
        : ok({ name, requestId: text });
    case 'setup':
      return ok({ name, provider: rest[0] ?? null });
    case 'profile':
      if (rest[0] === 'send')
        return rest.length < 3
          ? fail(DEVICE_USAGE)
          : ok({ name: 'device', args: ['--send-profile', ...rest.slice(1)] });
      return rest[0] === 'add'
        ? ok({ name, args: rest.slice(1) })
        : fail(
            'usage: clideck profile add "<name>" <template> [--<field> <value>]... (see clideck profile add with no template)',
          );
    case 'install':
      return ok({ name, force: rest.includes('--force') });
    default:
      return fail(`unknown command "${name}". Try: clideck help`);
  }
}
