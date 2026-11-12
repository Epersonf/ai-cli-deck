import type { QueryLike } from './claudeDriver.js';

/** How long a stopped answer may take to wind down before the process is cut. */
const FORCE_STOP_MS = 5000;

/** Asks the agent to stop the answer in progress; if it does not wind down in time, `cut` ends the run. */
export function stopAnswer(query: QueryLike, cut: () => void): void {
  const timer = setTimeout(cut, FORCE_STOP_MS);
  timer.unref();
  query.interrupt().catch(cut);
}

/** Ends the run now: aborts it and closes the SDK query. */
export function cutRun(abort: AbortController, query: QueryLike | null): void {
  abort.abort();
  try {
    query?.close();
  } catch {
    // already closed
  }
}
