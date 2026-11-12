import type { AgentPort } from '../../domain/agent.js';
import { claudeRewind } from './claudeRewind.js';
import type { SdkMessage } from './claudeMap.js';
import { ClaudeRun } from './claudeRun.js';

/** The slice of the SDK's `Query` the driver uses, so tests can fake it. */
export interface QueryLike extends AsyncIterable<SdkMessage> {
  interrupt(): Promise<unknown>;
  setModel(model?: string): Promise<void>;
  setPermissionMode(mode: string): Promise<void>;
  stopTask(taskId: string): Promise<void>;
  supportedModels(): Promise<Array<{ value: string; displayName?: string; description?: string }>>;
  rewindFiles(userMessageId: string): Promise<{ canRewind: boolean; error?: string }>;
  close(): void;
}
export type QueryFn = (params: {
  prompt: AsyncIterable<unknown>;
  options: Record<string, unknown>;
}) => QueryLike;

/** Runs conversations through the Claude Agent SDK (which starts Claude Code itself). */
export function createClaudeDriver(queryFn: QueryFn): AgentPort {
  return {
    start: (spec, sink) => new ClaudeRun(spec, sink, queryFn),
    rewind: (spec, userId, revertFiles) => claudeRewind(queryFn, spec, userId, revertFiles),
  };
}
