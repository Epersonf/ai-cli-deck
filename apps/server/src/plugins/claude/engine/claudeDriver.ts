import type { AgentPort } from '../../../domain/agent.js';
import { claudeRewind } from './claudeRewind.js';
import type { SdkMessage } from './claudeMap.js';
import { ClaudeRun } from './claudeRun.js';

/** The part of the SDK's usage answer the deck reads: the plan's windows, as percent and reset time. */
export interface ClaudeUsageAnswer {
  rate_limits_available?: boolean;
  rate_limits?: Record<string, unknown> | null;
}

/** The slice of the SDK's `Query` the driver uses, so tests can fake it. */
export interface QueryLike extends AsyncIterable<SdkMessage> {
  interrupt(): Promise<unknown>;
  setModel(model?: string): Promise<void>;
  setPermissionMode(mode: string): Promise<void>;
  stopTask(taskId: string): Promise<void>;
  applyFlagSettings(settings: Record<string, unknown>): Promise<void>;
  /** The data behind `/usage` (experimental in the SDK, so optional here). */
  usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET?(opts?: {
    skipBehaviors?: boolean;
  }): Promise<ClaudeUsageAnswer>;
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
    capabilities: () => Promise.resolve({ fork: true, compact: true }),
    start: (spec, sink) => new ClaudeRun(spec, sink, queryFn),
    rewind: (spec, userId, revertFiles) => claudeRewind(queryFn, spec, userId, revertFiles),
  };
}
