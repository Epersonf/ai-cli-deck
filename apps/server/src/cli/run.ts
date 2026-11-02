import { homedir } from 'node:os';
import { call, readEnv } from './client.js';
import { HELP } from './help.js';
import { installSlashCommands } from './install.js';
import { parseArgs, type Command } from './parse.js';

const show = (value: unknown): string => JSON.stringify(value, null, 2);

async function execute(command: Command, env: NodeJS.ProcessEnv): Promise<string> {
  if (command.name === 'help') return HELP;
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
  try {
    console.log(await execute(parsed.command, env));
    return 0;
  } catch (error) {
    console.error(`clideck: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
