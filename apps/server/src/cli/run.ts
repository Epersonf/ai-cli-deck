import { homedir } from 'node:os';
import { call, readEnv } from './client.js';
import { HELP } from './help.js';
import { installSlashCommands } from './install.js';
import { parseArgs, type Command } from './parse.js';
import { addProfile, knownTemplates, parseProfileArgs } from './profileCommand.js';
import { runSetup } from './setupCommand.js';
import { phoneCommand } from './phoneCommand.js';
import { runTask } from './taskCommand.js';
import { memoryCommand } from './memoryCommand.js';
import { deviceCommand } from './deviceCommand.js';

const show = (value: unknown): string => JSON.stringify(value, null, 2);

/** Commands that print a result. */
async function execute(command: Command, env: NodeJS.ProcessEnv): Promise<string> {
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
    case 'task':
      return runTask(deck, command.action, command.args);
    case 'memory':
      return memoryCommand(deck, command.args);
    case 'device':
      return deviceCommand(deck, command.args);
    case 'phone':
      return phoneCommand(deck, command);
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
    case 'folder':
      return show(
        await call(deck, 'POST', '/folder', { path: command.path, reason: command.reason }),
      );
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
