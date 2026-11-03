import type { Terminal } from '@xterm/xterm';
import type { Latency } from './latencyMeter';
import { createOverlay, screenOf } from './predictionOverlay';
import { createPredictor } from './predictor';

/** Wires the predictor to a terminal: guesses typed keys while the link is slow, shows them as an overlay. */
export function attachLocalEcho(term: Terminal, latency: () => Latency) {
  const overlay = createOverlay(term);
  const predictor = createPredictor({
    screen: screenOf(term),
    latency: () => {
      const { net, echo } = latency();
      return net === null && echo === null ? null : Math.max(net ?? 0, echo ?? 0);
    },
  });
  let expiry = 0;
  const paint = (): void => {
    overlay.render(predictor.view());
    window.clearTimeout(expiry);
    if (predictor.hasPending()) {
      expiry = window.setTimeout(() => (predictor.tick(), paint()), 150);
    }
  };
  return {
    /** Call with every chunk the user types. */
    input(data: string): void {
      if (predictor.input(data)) paint();
    },
    /** Call once server output has been written to the terminal. */
    written(): void {
      if (predictor.afterWrite() || predictor.hasPending()) paint();
    },
    dispose(): void {
      window.clearTimeout(expiry);
      overlay.clear();
    },
  };
}
