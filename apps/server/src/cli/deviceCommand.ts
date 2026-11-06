import type { ExecResult } from '@deck/shared';
import { call, type Env } from './client.js';

const show = (value: unknown): string => JSON.stringify(value, null, 2);
const q = encodeURIComponent;

export const DEVICE_USAGE = `usage: clideck devices
       clideck device <name> run "<command>" [--cwd <dir>] [--timeout <seconds>]
       clideck device <name> terminals | open <profile> [--cwd <dir>] [--command "<cmd>"]
       clideck device <name> send <terminal> "<text>" [--no-enter] | read <terminal> [--lines N] | close <terminal>`;

/** `--flag value` pairs pulled out of the words; the rest stays in order. */
function split(words: readonly string[]): { rest: string[]; flags: Map<string, string> } {
  const rest: string[] = [];
  const flags = new Map<string, string>();
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i] ?? '';
    if (word === '--no-enter') flags.set(word, '1');
    else if (word.startsWith('--') && i + 1 < words.length) flags.set(word, words[(i += 1)] ?? '');
    else rest.push(word);
  }
  return { rest, flags };
}

const number = (value: string | undefined): number | undefined =>
  value === undefined ? undefined : Number(value);

/** The command's output, then one line on how it ended (exit code, where it ran). */
function ran(device: string, result: ExecResult): string {
  const end = result.timedOut ? 'stopped: took too long' : `exit ${result.exitCode ?? '?'}`;
  const cut = result.truncated ? ' (only the end of the output is shown)' : '';
  return `${result.output.replace(/\s+$/, '')}\n[${end} on ${device}, ${result.platform} ${result.shell}, in ${result.cwd}${cut}]`;
}

/** `clideck devices` and `clideck device <name> ...`: the decks this one is paired with. */
export async function deviceCommand(deck: Env, args: readonly string[]): Promise<string> {
  const [device, action, ...words] = args;
  if (device === undefined) return show(await call(deck, 'GET', '/devices'));
  const { rest, flags } = split(words);
  const [first = '', ...more] = rest;
  switch (action) {
    case 'run': {
      const command = rest.join(' ').trim();
      if (!command) throw new Error(DEVICE_USAGE);
      const body = {
        device,
        command,
        cwd: flags.get('--cwd'),
        timeoutSec: number(flags.get('--timeout')),
      };
      return ran(device, (await call(deck, 'POST', '/devices/run', body)) as ExecResult);
    }
    case 'terminals':
      return show(await call(deck, 'GET', `/devices/terminals?device=${q(device)}`));
    case 'open': {
      if (!first) throw new Error(DEVICE_USAGE);
      const body = {
        device,
        profile: first,
        cwd: flags.get('--cwd'),
        command: flags.get('--command'),
      };
      return show(await call(deck, 'POST', '/devices/open', body));
    }
    case 'send': {
      if (!first) throw new Error(DEVICE_USAGE);
      const body = {
        device,
        terminal: first,
        text: more.join(' '),
        enter: !flags.has('--no-enter'),
      };
      return show(await call(deck, 'POST', '/devices/send', body));
    }
    case 'read': {
      if (!first) throw new Error(DEVICE_USAGE);
      const lines = flags.get('--lines') ?? '60';
      const path = `/devices/read?device=${q(device)}&terminal=${q(first)}&lines=${q(lines)}`;
      return ((await call(deck, 'GET', path)) as { text: string }).text;
    }
    case 'close':
      if (!first) throw new Error(DEVICE_USAGE);
      return show(await call(deck, 'POST', '/devices/close', { device, terminal: first }));
    default:
      throw new Error(DEVICE_USAGE);
  }
}
