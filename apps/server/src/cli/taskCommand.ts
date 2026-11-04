import { call, type Env } from './client.js';

const show = (value: unknown): string => JSON.stringify(value, null, 2);

const option = (args: readonly string[], flag: string): string | undefined => {
  const at = args.indexOf(flag);
  return at >= 0 ? args[at + 1] : undefined;
};

const percent = (args: readonly string[], flag: string): number | undefined => {
  const value = option(args, flag);
  return value === undefined ? undefined : Number(value);
};

/** `clideck task ...`: background jobs of this terminal. */
export async function runTask(deck: Env, action: string, args: readonly string[]): Promise<string> {
  const id = encodeURIComponent(args[0] ?? '');
  switch (action) {
    case 'list':
      return show(await call(deck, 'GET', '/tasks'));
    case 'stop':
      return show(await call(deck, 'DELETE', `/tasks/${id}`));
    case 'log':
      return ((await call(deck, 'GET', `/tasks/${id}/log`)) as { text: string }).text;
    case 'battery': {
      const body = {
        below: percent(args, '--below'),
        above: percent(args, '--above'),
        text: option(args, '--text'),
        name: option(args, '--name'),
      };
      return show(await call(deck, 'POST', '/tasks/battery', body));
    }
    default: {
      const flag = args.indexOf('--name');
      const words = flag >= 0 ? args.slice(0, flag) : args;
      const command = words.join(' ').trim();
      if (command === '') throw new Error('usage: clideck task run "<command>" [--name N]');
      return show(await call(deck, 'POST', '/tasks', { command, name: option(args, '--name') }));
    }
  }
}
