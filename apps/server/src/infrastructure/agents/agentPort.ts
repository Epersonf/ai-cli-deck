import type { AgentPort } from '../../domain/agent.js';
import { createClaudeDriver, type QueryFn } from './claudeDriver.js';
import { codexDriver } from './codexDriver.js';

/** Routes a session to the engine its provider names. */
export function createAgentPort(claudeQuery: QueryFn): AgentPort {
  const claude = createClaudeDriver(claudeQuery);
  const engine = (kind: string): AgentPort => (kind === 'codex' ? codexDriver : claude);
  return {
    capabilities: (spec) =>
      engine(spec.kind).capabilities?.(spec) ??
      Promise.resolve({ fork: spec.kind === 'claude', compact: spec.kind === 'claude' }),
    compact: (spec, sink, signal) => {
      const compact = engine(spec.kind).compact;
      if (!compact)
        return Promise.reject(new Error('Manual compaction is not supported by this agent'));
      return compact(spec, sink, signal);
    },
    start: (spec, sink) => engine(spec.kind).start(spec, sink),
    rewind: (spec, userId, revertFiles) => engine(spec.kind).rewind(spec, userId, revertFiles),
  };
}
