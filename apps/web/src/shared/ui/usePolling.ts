import { useEffect, useRef } from 'react';
import { useSaver } from '../power/saverStore';

/** Energy saving asks this many times less often. */
const SAVING_FACTOR = 3;

/**
 * Runs `task` now and then every `ms`; errors are ignored (the next tick retries). Nothing runs while the
 * page is hidden (a phone with the screen off); coming back to the page runs it once at once.
 */
export function usePolling(task: () => Promise<unknown>, ms: number): void {
  const latest = useRef(task);
  latest.current = task;
  const every = useSaver((s) => s.saving) ? ms * SAVING_FACTOR : ms;
  useEffect(() => {
    const run = (): void => void latest.current().catch(() => undefined);
    const ifShown = (): void => {
      if (!document.hidden) run();
    };
    run();
    const timer = window.setInterval(ifShown, every);
    document.addEventListener('visibilitychange', ifShown);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', ifShown);
    };
  }, [every]);
}
