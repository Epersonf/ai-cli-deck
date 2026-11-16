import type { ProviderRegistry } from '../../domain/provider.js';
import type { AgentPort, AgentSpec } from '../../domain/agent.js';

/** The execution engine is supplied by the profile's provider plugin. */
export function createAgentPort(providers: ProviderRegistry): AgentPort {
  const engine = (spec: AgentSpec): AgentPort => {
    const driver = spec.providerId ? providers.get(spec.providerId)?.driver : null;
    if (!driver) throw new Error(`No execution plugin for ${spec.providerId ?? spec.kind}`);
    return driver;
  };
  return {
    capabilities: (spec) =>
      engine(spec).capabilities?.(spec) ?? Promise.resolve({ fork: false, compact: false }),
    compact: (spec, sink, signal) => {
      const compact = engine(spec).compact;
      if (!compact)
        return Promise.reject(new Error('Manual compaction is not supported by this agent'));
      return compact(spec, sink, signal);
    },
    start: (spec, sink) => engine(spec).start(spec, sink),
    rewind: (spec, userId, revertFiles) => engine(spec).rewind(spec, userId, revertFiles),
  };
}
