import type { ChatConfig } from '@deck/shared';
import { tokens } from './usageFormat';

/** The thresholds on offer, in context tokens. */
const STEPS = [100_000, 150_000, 200_000, 300_000, 500_000];

export const autoCompactId = (value: ChatConfig['autoCompact']): string =>
  value === null ? '' : String(value);

/** The auto-compact choices of this chat's agent: its default, the thresholds, and never when the agent can. */
export function autoCompactOptions(
  config: ChatConfig,
  defaultLabel: string,
  offLabel: string,
): { id: string; label: string }[] {
  const current = typeof config.autoCompact === 'number' ? [config.autoCompact] : [];
  const steps = [...new Set([...STEPS, ...current])].sort((a, b) => a - b);
  return [
    { id: '', label: defaultLabel },
    ...steps.map((n) => ({ id: String(n), label: tokens(n) })),
    // Codex has no way to turn it off: only Claude Code does.
    ...(config.agent === 'claude' ? [{ id: 'off', label: offLabel }] : []),
  ];
}
