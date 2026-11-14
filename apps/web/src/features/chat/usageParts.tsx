import { useEffect, useState } from 'react';
import { band, percent } from './usageFormat';

export function Bar({ fraction, label }: { fraction: number; label: string }) {
  return (
    <div
      className="gauge"
      role="meter"
      aria-label={label}
      aria-valuenow={Math.round(fraction * 100)}
    >
      <span className={`gauge-fill ${band(fraction)}`} style={{ width: percent(fraction) }} />
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
