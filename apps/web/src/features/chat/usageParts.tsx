import { useEffect, useState } from 'react';
import { band, percent } from './usageFormat';

/**
 * A gauge filled to `fraction`. Its colour follows `tone` (how worrying it is, 0..1), which is the fraction
 * itself unless the bar fills up as things go well (a cache with time left): then the tone is the opposite.
 */
export function Bar({
  fraction,
  label,
  tone = fraction,
}: {
  fraction: number;
  label: string;
  tone?: number;
}) {
  return (
    <div
      className="gauge"
      role="meter"
      aria-label={label}
      aria-valuenow={Math.round(fraction * 100)}
    >
      <span className={`gauge-fill ${band(tone)}`} style={{ width: percent(fraction) }} />
    </div>
  );
}

/** The current time, refreshed every `ms` while `active` (for countdowns). */
export function useNow(active: boolean, ms: number): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [active, ms]);
  return now;
}
