import type { ProviderContext } from '../domain/provider.js';

export const providerCtx: ProviderContext = {
  sessionId: 's1',
  cwd: '/work',
  port: 4100,
  mcpUrl: 'http://127.0.0.1:7842/mcp/s1',
  command: null,
  args: [],
  secrets: { deepseekApiKey: null, anthropicApiKey: null, openaiApiKey: null },
  defaultShell: 'bash',
};
