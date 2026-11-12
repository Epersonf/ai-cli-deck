import { AGENT_GUIDE } from '../infrastructure/providers/agentGuide.js';
import type { ProviderContext } from '../domain/provider.js';

export const providerCtx: ProviderContext = {
  sessionId: 's1',
  cwd: '/work',
  port: 4100,
  mcpUrl: 'http://127.0.0.1:7842/mcp/s1',
  guide: AGENT_GUIDE,
};
