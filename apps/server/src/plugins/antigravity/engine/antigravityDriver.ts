import type { AgentPort } from '../../../domain/agent.js';
import { AntigravityRun } from './antigravityRun.js';

export const antigravityDriver: AgentPort = {
  capabilities: () => Promise.resolve({ fork: false, compact: false }),
  start: (spec, sink) => new AntigravityRun(spec, sink),
  rewind: () => Promise.resolve({ resumeAt: null }),
};
