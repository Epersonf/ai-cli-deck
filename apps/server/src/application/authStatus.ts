import type { AgentKind, AuthInfo } from '@deck/shared';
import { claudeAuthStatus } from '../plugins/claude/auth.js';
import { codexAuthStatus } from '../plugins/codex/auth.js';

/** Compatibility for the former CLI port. Production authentication is supplied by each plugin. */
export function readAuthStatus(
  agent: AgentKind,
  answer: { code: number | null; output: string } | null,
  machine: boolean,
): AuthInfo {
  if (agent === 'claude') return claudeAuthStatus(answer, machine);
  if (agent === 'codex') return codexAuthStatus(answer, machine);
  return { state: 'unknown', via: null, account: null };
}
