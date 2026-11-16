import type { AgentKind } from '@deck/shared';
import { codexGuide } from '../../plugins/codex/codexGuide.js';
import { agentGuide } from './agentGuide.js';
import type { Provider } from '../../domain/provider.js';
import { chatSupport } from '../chats/chatSupport.js';

/** An agent on this machine's own sign-in and config folder (no profile). */
export function createBuiltin(id: string, label: string, agent: AgentKind): Provider {
  return {
    id,
    label,
    agent,
    guide: agent === 'codex' ? codexGuide : agentGuide,
    compactTools: agent === 'codex',
    discoverModels: () => Promise.resolve({ choices: [], current: null }),
    discoverLimits: () => Promise.resolve([]),
    buildAgent: () => ({ kind: agent, env: {}, model: null }),
    shellEnv: () => ({}),
    chat: chatSupport(agent, null),
    keyState: () => 'none',
    login: { env: () => ({}), own: () => false, setOwn: () => undefined },
  };
}

export const claude = createBuiltin('claude', 'Claude Code', 'claude');
