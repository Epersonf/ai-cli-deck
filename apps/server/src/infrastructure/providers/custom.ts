import { invalid } from '../../domain/errors.js';
import type { Provider } from '../../domain/provider.js';

export const custom: Provider = {
  id: 'custom',
  label: 'Custom command',
  buildCommand: (ctx) => {
    if (ctx.command === null) throw invalid('The custom provider needs a "command"');
    return { command: ctx.command, args: [...ctx.args], env: {} };
  },
  buildMcpConfig: () => ({ args: [], env: {} }),
};
