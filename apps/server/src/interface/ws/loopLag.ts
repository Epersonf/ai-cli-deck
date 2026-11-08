import { monitorEventLoopDelay } from 'node:perf_hooks';

const WINDOW_MS = 3000;
const histogram = monitorEventLoopDelay({ resolution: 10 });
let lag = 0;
let started = false;

/** Worst-case (99th percentile) event loop delay in ms over the last few seconds. */
export function loopLagMs(): number {
  if (!started) {
    started = true;
    histogram.enable();
    setInterval(() => {
      lag = Math.round(histogram.percentile(99) / 1e6);
      histogram.reset();
    }, WINDOW_MS).unref();
  }
  return lag;
}
