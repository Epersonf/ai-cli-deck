import { useEffect, useRef } from 'react';

/** Runs `task` now and then every `ms`; errors are ignored (the next tick retries). */
export function usePolling(task: () => Promise<unknown>, ms: number): void {
  const latest = useRef(task);
  latest.current = task;
  useEffect(() => {
    const run = (): void => void latest.current().catch(() => undefined);
    run();
    const timer = window.setInterval(run, ms);
    return () => window.clearInterval(timer);
  }, [ms]);
}
