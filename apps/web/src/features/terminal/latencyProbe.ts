import type { createLatencyMeter, Latency } from './latencyMeter';

const PROBE_MS = 3000;

/** Pings the server now and then and records how late this page's own timer fired. Returns the stop function. */
export function startLatencyProbe(
  meter: ReturnType<typeof createLatencyMeter>,
  ping: () => void,
  show: (latency: Latency) => void,
): () => void {
  let at = performance.now();
  const timer = window.setInterval(() => {
    meter.drift(performance.now() - at - PROBE_MS);
    at = performance.now();
    meter.ping();
    ping();
    show(meter.get());
  }, PROBE_MS);
  return () => window.clearInterval(timer);
}
