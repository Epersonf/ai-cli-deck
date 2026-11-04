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
    default:
      return show(await call(deck, 'GET', `/phone/${action}`));
  }
}
