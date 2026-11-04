import { homedir } from 'node:os';
import { call, readEnv } from './client.js';
import { HELP } from './help.js';
import { installSlashCommands } from './install.js';
import { parseArgs, type Command } from './parse.js';
import { addProfile, knownTemplates, parseProfileArgs } from './profileCommand.js';
import { ensureKey } from './ensureKey.js';
import { runSetup } from './setupCommand.js';
import { readStdin } from './stdin.js';

const show = (value: unknown): string => JSON.stringify(value, null, 2);

/** Commands that print a result; `ensure-key` starts a program instead and is handled in run(). */
async function execute(
  command: Exclude<Command, { name: 'ensure-key' }>,
  env: NodeJS.ProcessEnv,
): Promise<string> {
  if (command.name === 'help') return HELP;
  if (command.name === 'setup') return runSetup(command.provider);
  if (command.name === 'profile') {
    const request = parseProfileArgs(command.args, await knownTemplates(env));
    return typeof request === 'string' ? request : addProfile(request);
  }
  if (command.name === 'install')
    return (await installSlashCommands(homedir(), command.force)).join('\n');
  const deck = readEnv(env);
  if (!deck)
    throw new Error('Not inside an ai-cli-deck session (DECK_URL / DECK_SESSION_ID are not set).');
  switch (command.name) {
    case 'port':
      return env['PORT'] ?? show(await call(deck, 'GET', '/whoami'));
    case 'whoami':
      return show(await call(deck, 'GET', '/whoami'));
    case 'sessions':
      return show(await call(deck, 'GET', '/sessions'));
    case 'phone':
      return show(
        command.action === 'notify'
          ? await call(deck, 'POST', '/phone/notify', { text: command.text, title: command.title })
          : await call(deck, 'GET', `/phone/${command.action}`),
      );
    case 'handoff': {
      if (command.text === null) return show(await call(deck, 'GET', '/handoff'));
      const text = command.text === '-' ? await readStdin() : command.text;
      return show(await call(deck, 'PUT', '/handoff', { text }));
    }
    case 'meta': {
      if (command.value !== null && command.key !== null)
        return show(await call(deck, 'PUT', '/meta', { key: command.key, value: command.value }));
      const query = command.key === null ? '' : `?key=${encodeURIComponent(command.key)}`;
      return show(await call(deck, 'GET', `/meta${query}`));
    }
    case 'title': {
      const reply = (await (command.title === null
        ? call(deck, 'GET', '/title')
        : call(deck, 'POST', '/title', { title: command.title }))) as { title: string | null };
      return reply.title ?? '(no title)';
    }
    case 'preview':
      return show(await call(deck, 'POST', '/preview', { url: command.url }));
    case 'newtab':
      return show(await call(deck, 'POST', '/newtab', { url: command.url }));
    case 'worktree':
      return show(await call(deck, 'POST', '/worktree', { reason: command.reason }));
    case 'status':
      return show(await call(deck, 'GET', `/requests/${encodeURIComponent(command.requestId)}`));
  }
}

/** Returns the process exit code; prints to stdout/stderr. */
export async function run(argv: readonly string[], env: NodeJS.ProcessEnv): Promise<number> {
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.error);
    return 2;
  }
  // Starts another program and returns its exit code, so it bypasses the print-a-string path below.
  if (parsed.command.name === 'ensure-key') return ensureKey(parsed.command, env);
  try {
    console.log(await execute(parsed.command, env));
    return 0;
  } catch (error) {
    console.error(`clideck: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
