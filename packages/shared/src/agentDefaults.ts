import {
  EffortSchema,
  PermissionModeSchema,
  type AgentKind,
  type Effort,
  type PermissionMode,
} from './agent.js';

/** Compatibility defaults for legacy JSON profiles; plugins advertise their own features. */
export const AGENT_MODES: Record<AgentKind, readonly PermissionMode[]> = {
  claude: PermissionModeSchema.options,
  codex: ['plan', 'default', 'bypassPermissions'],
  antigravity: ['default', 'acceptEdits', 'plan'],
  grok: ['default', 'acceptEdits', 'bypassPermissions'],
};
export const AGENT_EFFORTS: Record<AgentKind, readonly Effort[]> = {
  claude: EffortSchema.options,
  codex: ['low', 'medium', 'high', 'xhigh'],
  antigravity: EffortSchema.options,
  grok: ['low', 'medium', 'high', 'xhigh'],
};
