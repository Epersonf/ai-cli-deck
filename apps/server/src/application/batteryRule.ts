export interface BatteryRule {
  below?: number | undefined;
  above?: number | undefined;
  /** What the notification says; a default describing the reading when empty. */
  text?: string | undefined;
}

/** A sentence describing the reading when it meets the rule, or null while it does not. */
export function checkBattery(rule: BatteryRule, reading: unknown): string | null {
  const percent = (reading as { percent?: unknown } | null)?.percent;
  if (typeof percent !== 'number') return null;
  if (rule.below !== undefined && percent <= rule.below)
    return `Battery at ${percent}% (at or below ${rule.below}%)`;
  if (rule.above !== undefined && percent >= rule.above)
    return `Battery at ${percent}% (at or above ${rule.above}%)`;
  return null;
}

/** A short name for a watcher of this rule, e.g. "battery <= 10%". */
export const batteryName = (rule: BatteryRule): string =>
  [
    rule.below !== undefined && `battery <= ${rule.below}%`,
    rule.above !== undefined && `battery >= ${rule.above}%`,
  ]
    .filter(Boolean)
    .join(' / ');
