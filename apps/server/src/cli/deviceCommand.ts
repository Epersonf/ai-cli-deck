import { isAbsolute, resolve } from 'node:path';
import type { ExecResult } from '@deck/shared';
import { call, type Env } from './client.js';

const show = (value: unknown): string => JSON.stringify(value, null, 2);

export const DEVICE_USAGE = `usage: clideck devices
       clideck device <name|here> run "<command>" [--cwd <dir>] [--timeout <seconds>]
       clideck device <name|here> terminals | open <profile> [--cwd <dir>] [--command "<cmd>"]
       clideck device <name|here> send <terminal> "<text>" [--no-enter] | read <terminal> [--lines N]
       clideck device <name|here> restart <terminal> [--new] | close <terminal>
       clideck device <name|here> task run "<command>" [--cwd <dir>] [--name N] | task list | task log <id> | task stop <id>
       clideck device <name|here> profiles
       clideck copy <[device:]path> <[device:]path>
       clideck profile send <profile> <device> [--from <device>] [--chats]`;

const BOOLEAN_FLAGS = new Set(['--no-enter', '--new', '--chats']);

/** `--flag value` pairs pulled out of the words; the rest stays in order. */
export function split(words: readonly string[]): { rest: string[]; flags: Map<string, string> } {
  const rest: string[] = [];
  const flags = new Map<string, string>();
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i] ?? '';
    if (BOOLEAN_FLAGS.has(word)) flags.set(word, '1');
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
  const where = `${device}, ${result.platform} ${result.shell}, in ${result.cwd}`;
  return `${result.output.replace(/\s+$/, '')}\n[${end} on ${where}${cut}]`;
}

/** The action `clideck device <device> <words>` asks for (the body the deck's /devices endpoint takes). */
export function deviceAction(device: string, words: readonly string[]): Record<string, unknown> {
  const [verb = '', ...more] = words;
  const { rest, flags } = split(more);
  const [first, ...others] = rest;
  const text = rest.join(' ').trim();
  const base = { device, cwd: flags.get('--cwd') };
  switch (verb) {
    case 'run':
      return { ...base, action: 'run', command: text, timeoutSec: number(flags.get('--timeout')) };
    case 'terminals':
    case 'profiles':
      return { device, action: verb };
    case 'open':
      return { ...base, action: 'open', profile: first, command: flags.get('--command') };
    case 'send': {
      const enter = !flags.has('--no-enter');
      return { device, action: 'send', terminal: first, text: others.join(' '), enter };
    }
    case 'read':
      return { device, action: 'read', terminal: first, lines: number(flags.get('--lines')) };
    case 'restart':
      return { device, action: 'restart', terminal: first, fresh: flags.has('--new') };
    case 'close':
      return { device, action: 'close', terminal: first };
    case 'task': {
      const [sub = 'list', ...args] = rest;
      if (sub === 'run') {
        const command = args.join(' ').trim();
        return { ...base, action: 'task_run', command, name: flags.get('--name') };
      }
      return { device, action: `task_${sub}`, id: args[0] };
    }
    default:
      throw new Error(DEVICE_USAGE);
  }
}

/** A bare relative path means this folder (where `clideck` runs), whatever the deck's own folder is. */
const spot = (text: string): string =>
  /^[^:\\/]{2,80}:/.test(text) || isAbsolute(text) || text.startsWith('~') ? text : resolve(text);

/** `clideck devices`, `clideck device ...`, `clideck copy` and `clideck profile send`. */
export async function deviceCommand(deck: Env, args: readonly string[]): Promise<string> {
  const [first, ...words] = args;
  if (first === undefined) return show(await call(deck, 'POST', '/devices', { action: 'list' }));
  if (first === '--copy') {
    const [from, to] = words;
    if (!from || !to) throw new Error(DEVICE_USAGE);
    const body = { action: 'copy', from: spot(from), to: spot(to) };
    return show(await call(deck, 'POST', '/devices', body));
  }
  if (first === '--send-profile') {
    const { rest, flags } = split(words);
    const [profile, to] = rest;
    if (!profile || !to) throw new Error(DEVICE_USAGE);
    const body = {
      action: 'send_profile',
      profile,
      to,
      from: flags.get('--from'),
      chats: flags.has('--chats'),
    };
    return show(await call(deck, 'POST', '/devices', body));
  }
  const body = deviceAction(first, words);
  const result = await call(deck, 'POST', '/devices', body);
  if (body.action === 'run') return ran(first, result as ExecResult);
  if (body.action === 'read' || body.action === 'task_log')
    return (result as { text: string }).text;
  return show(result);
}
