import { call, type Env } from './client.js';
import type { Command } from './parse.js';

const show = (value: unknown): string => JSON.stringify(value, null, 2);

const option = (args: readonly string[], flag: string): string | undefined => {
  const at = args.indexOf(flag);
  return at >= 0 ? args[at + 1] : undefined;
};

/** `clideck phone ...`: the phone the deck runs on (only works when enabled in the Android app). */
export async function phoneCommand(
  deck: Env,
  command: Extract<Command, { name: 'phone' }>,
): Promise<string> {
  const { action, args } = command;
  switch (action) {
    case 'notify':
      return show(
        await call(deck, 'POST', '/phone/notify', { text: command.text, title: command.title }),
      );
    case 'wifi-status':
      return show(await call(deck, 'GET', '/phone/wifi'));
    case 'wifi-scan':
      return show(await call(deck, 'GET', '/phone/wifi/scan'));
    case 'wifi-on':
    case 'wifi-off':
      return show(await call(deck, 'POST', '/phone/wifi/enable', { on: action === 'wifi-on' }));
    case 'wifi-connect': {
      const password = option(args, '--password');
      const body = { ssid: args[0], ...(password === undefined ? {} : { password }) };
      return show(await call(deck, 'POST', '/phone/wifi/connect', body));
    }
    case 'help':
      return phoneHelp(await call(deck, 'GET', '/phone/capabilities'));
    case 'call': {
      const [first = '', ...rest] = args;
      const second = rest[0] && !rest[0].startsWith('--') ? rest[0] : undefined;
      const options = second ? rest.slice(1) : rest;
      const body: Record<string, string> = {};
      for (let i = 0; i + 1 < options.length; i += 2)
        body[(options[i] ?? '').replace(/^--/, '')] = options[i + 1] ?? '';
      const path = `/${first}${second ? `/${second}` : ''}`;
      return show(await call(deck, 'POST', '/phone/call', { path, args: body }));
    }
    default:
      return show(await call(deck, 'GET', `/phone/${action}`));
  }
}

/** What the phone allows right now, as lines an agent can act on. */
function phoneHelp(reply: unknown): string {
  const { always = [], enabled = [] } = reply as {
    always?: string[];
    enabled?: Array<{ id: string; risk: string; usage: string }>;
  };
  const lines = [
    'clideck phone <command>. Always available:',
    ...always.map((a) => `  ${a}`),
    '',
    'Enabled by the user:',
  ];
  for (const cap of enabled) lines.push(`  [${cap.risk}] ${cap.usage}`);
  if (enabled.length === 0)
    lines.push('  (nothing else: the user can tick more in the Android app settings)');
  lines.push(
    '',
    'Options are --name value pairs. Things marked "needs the user\'s tap" wait for an Allow button on the phone.',
  );
  return lines.join('\n');
}
