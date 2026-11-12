import type { AgentPort } from '../../domain/agent.js';
import { createClaudeDriver, type QueryFn } from './claudeDriver.js';
import { codexDriver } from './codexDriver.js';

/** Routes a session to the engine its provider names. */
export function createAgentPort(claudeQuery: QueryFn): AgentPort {
  const claude = createClaudeDriver(claudeQuery);
  const engine = (kind: string): AgentPort => (kind === 'codex' ? codexDriver : claude);
  return {
    start: (spec, sink) => engine(spec.kind).start(spec, sink),
    rewind: (spec, userId, revertFiles) => engine(spec.kind).rewind(spec, userId, revertFiles),
  };
}
