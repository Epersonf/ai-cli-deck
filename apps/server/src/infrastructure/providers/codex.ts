import type { Provider } from '../../domain/provider.js';
import { CODEX_CHAT, chatSupport } from '../chats/chatSupport.js';

export const codex: Provider = {
  id: 'codex',
  label: 'Codex',
  buildCommand: (ctx) => ({ command: 'codex', args: [...ctx.args], env: {} }),
  buildMcpConfig: (ctx) => ({
    args: [
      '-c',
      `mcp_servers.deck.url=${JSON.stringify(ctx.mcpUrl)}`,
      '-c',
      `developer_instructions=${JSON.stringify(ctx.guide)}`,
    ],
    env: {},
  }),
  chat: chatSupport(CODEX_CHAT, null),
};
