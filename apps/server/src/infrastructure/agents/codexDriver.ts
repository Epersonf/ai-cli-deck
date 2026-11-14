import type { AgentPort } from '../../domain/agent.js';
import { CodexRun } from './codexRun.js';
import { codexCapabilities } from './codexCapabilities.js';
import { compactCodex } from './codexCompact.js';

/** Codex cannot go back inside a saved thread: an edited message starts a new one (the deck replays the chat). */
export const codexDriver: AgentPort = {
  capabilities: (spec) => codexCapabilities(spec.env),
  compact: compactCodex,
  start: (spec, sink) => new CodexRun(spec, sink),
  rewind: () => Promise.resolve({ resumeAt: null }),
};
