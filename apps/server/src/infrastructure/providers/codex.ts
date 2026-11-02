import type { Provider } from '../../domain/provider.js';
import { AGENT_GUIDE } from './agentGuide.js';

export const codex: Provider = {
  id: 'codex',
  label: 'Codex',
  buildCommand: (ctx) => ({ command: 'codex', args: [...ctx.args], env: {} }),
  buildMcpConfig: (ctx) => ({
    args: [
      '-c',
      `mcp_servers.deck.url=${JSON.stringify(ctx.mcpUrl)}`,
      '-c',
      `developer_instructions=${JSON.stringify(AGENT_GUIDE)}`,
    ],
    env: {},
  }),
};
