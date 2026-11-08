export interface Latency {
  /** WebSocket round trip to the server (ms), or null before the first sample. */
  net: number | null;
  /** Key press until the first screen update came back (ms), or null before the first sample. */
  echo: number | null;
  /** How long the server's event loop was stuck lately (ms): work that delays every key. */
  server: number | null;
  /** How late this page's own timers ran (ms): a busy phone, not a slow link. */
  ui: number | null;
}

const SMOOTHING = 0.3;
const ECHO_WINDOW_MS = 1500;

const blend = (previous: number | null, sample: number): number =>
  previous === null ? sample : previous + (sample - previous) * SMOOTHING;

/**
 * Measures how responsive typing feels: the network round trip (ping/pong) and the full echo
 * time (key press -> output). Splitting the two shows whether the lag is the link or the CLI.
 */
export function createLatencyMeter(clock: () => number = () => performance.now()) {
  let state: Latency = { net: null, echo: null, server: null, ui: null };
  let pingAt: number | null = null;
  let keyAt: number | null = null;
  return {
    get: (): Latency => state,
    ping(): void {
      pingAt = clock();
    },
    pong(serverLag?: number): void {
      if (serverLag !== undefined) state = { ...state, server: serverLag };
      if (pingAt === null) return;
      state = { ...state, net: blend(state.net, clock() - pingAt) };
      pingAt = null;
    },
    /** How much later than planned a periodic timer fired. */
    drift(lateBy: number): void {
      state = { ...state, ui: blend(state.ui, Math.max(0, lateBy)) };
    },
    key(): void {
      keyAt ??= clock();
    },
    output(): void {
      if (keyAt === null) return;
      const took = clock() - keyAt;
      keyAt = null;
      if (took <= ECHO_WINDOW_MS) state = { ...state, echo: blend(state.echo, took) };
    },
  };
}
