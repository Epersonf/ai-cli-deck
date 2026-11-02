export interface Latency {
  /** WebSocket round trip to the server (ms), or null before the first sample. */
  net: number | null;
  /** Key press until the first screen update came back (ms), or null before the first sample. */
  echo: number | null;
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
  let state: Latency = { net: null, echo: null };
  let pingAt: number | null = null;
  let keyAt: number | null = null;
  return {
    get: (): Latency => state,
    ping(): void {
      pingAt = clock();
    },
    pong(): void {
      if (pingAt === null) return;
      state = { ...state, net: blend(state.net, clock() - pingAt) };
      pingAt = null;
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
