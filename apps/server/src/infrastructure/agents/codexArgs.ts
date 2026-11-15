import type { PermissionMode } from '@deck/shared';
import type { AgentSpec } from '../../domain/agent.js';

const SANDBOX: Record<PermissionMode, string> = {
  default: 'workspace-write',
  acceptEdits: 'workspace-write',
  auto: 'workspace-write',
  dontAsk: 'workspace-write',
  plan: 'read-only',
  bypassPermissions: 'danger-full-access',
};

/** A value as a TOML string (JSON strings are valid TOML basic strings). */
const toml = (value: string): string => JSON.stringify(value);

/**
 * The arguments of one `codex exec` turn. The prompt goes in on stdin. Codex cannot ask in this mode, so
 * the permission mode becomes a sandbox and it never stops to ask.
 */
export function codexArgs(spec: AgentSpec, chatId: string | null): string[] {
  const args = ['exec'];
  if (chatId) args.push(spec.fork ? 'fork' : 'resume', chatId);
  args.push('--json', '--skip-git-repo-check');
  if (spec.model) args.push('-m', spec.model);
  args.push(...codexConfigArgs(spec));
  return args;
}

/** Identical configuration for exec and manual compaction: preserve the rendered instructions. */
export function codexConfigArgs(spec: AgentSpec): string[] {
  const args: string[] = [];
  const config: Record<string, string> = {
    sandbox_mode: toml(SANDBOX[spec.mode]),
    approval_policy: toml('never'),
    // Bound retained tool output; the agent can request missing ranges explicitly.
    tool_output_token_limit: '6000',
    'mcp_servers.deck.url': toml(spec.mcpUrl),
    developer_instructions: toml(spec.guide),
  };
  if (spec.effort) config['model_reasoning_effort'] = toml(spec.effort);
  if (typeof spec.autoCompact === 'number')
    config['model_auto_compact_token_limit'] = String(spec.autoCompact);
  for (const [key, value] of Object.entries(config)) args.push('-c', `${key}=${value}`);
  return args;
}
