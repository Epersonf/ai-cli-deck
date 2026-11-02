import type { Provider } from '../../domain/provider.js';

export const codex: Provider = {
  id: 'codex',
  label: 'Codex',
  buildCommand: (ctx) => ({
    command: 'codex',
    args: [...ctx.args],
    env: ctx.secrets.openaiApiKey === null ? {} : { OPENAI_API_KEY: ctx.secrets.openaiApiKey },
  }),
  buildMcpConfig: (ctx) => ({
    args: ['-c', `mcp_servers.deck.url=${JSON.stringify(ctx.mcpUrl)}`],
    env: {},
  }),
};
