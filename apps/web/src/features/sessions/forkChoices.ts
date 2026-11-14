import type { ProviderInfo } from '@deck/shared';

/**
 * Where the conversation can go: every profile and built-in agent that can answer (installed, and with its
 * API key when it needs one), and always the current one, so a chat can move from any agent to any other.
 */
export const forkChoices = (list: readonly ProviderInfo[], current: string): ProviderInfo[] =>
  list.filter((p) => p.id === current || (p.status !== 'missing' && p.keyState !== 'missing'));
