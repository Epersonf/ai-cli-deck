import { useEffect, useState } from 'react';

/** The wall clock in ms, refreshed every `every` ms while `active`. */
export function useNow(every = 250, active = true): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [every, active]);
  return now;
}
