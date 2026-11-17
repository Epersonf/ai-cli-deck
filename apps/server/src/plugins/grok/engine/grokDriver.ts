import type { AgentPort } from '../../../domain/agent.js';
import { GrokRun } from './grokRun.js';

export const grokDriver: AgentPort = {
  capabilities: () => Promise.resolve({ fork: false, compact: false }),
  start: (spec, sink) => new GrokRun(spec, sink),
  rewind: () => Promise.resolve({ resumeAt: null }),
};
