import type { AgentKind } from '@deck/shared';
import type { Provider } from '../../domain/provider.js';
import { chatSupport } from '../chats/chatSupport.js';
import { discoverModels } from './modelDiscovery.js';

/** An agent on this machine's own sign-in and config folder (no profile). */
export function createBuiltin(id: string, label: string, agent: AgentKind): Provider {
  return {
    id,
    label,
    agent,
    discoverModels: () => discoverModels(agent, {}),
    buildAgent: () => ({ kind: agent, env: {}, model: null }),
    shellEnv: () => ({}),
    chat: chatSupport(agent, null),
    keyState: () => 'none',
    login: { env: () => ({}), own: () => false, setOwn: () => undefined },
  };
}

export const claude = createBuiltin('claude', 'Claude Code', 'claude');
