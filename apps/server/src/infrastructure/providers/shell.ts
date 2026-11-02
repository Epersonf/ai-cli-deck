import type { Provider } from '../../domain/provider.js';

/** A plain terminal: no AI CLI, just a shell in the chosen folder. */
export const shell: Provider = {
  id: 'shell',
  label: 'Shell',
  buildCommand: (ctx) => ({ command: ctx.command ?? 'bash', args: [...ctx.args], env: {} }),
  buildMcpConfig: () => ({ args: [], env: {} }),
};
