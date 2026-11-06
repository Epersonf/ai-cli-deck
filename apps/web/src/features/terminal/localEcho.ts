import type { Terminal } from '@xterm/xterm';
import type { Latency } from './latencyMeter';
import { createOverlay, screenOf } from './predictionOverlay';
import { createPredictor } from './predictor';

/** Quiet time after output before the screen is compared with the guesses. */
const SETTLE_MS = 20;

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
  let settle = 0;
  const paint = (): void => {
    overlay.render(predictor.view());
    window.clearTimeout(expiry);
    if (predictor.hasPending()) {
      expiry = window.setTimeout(() => (predictor.tick(), paint()), 150);
    }
  };
  // While an IME is composing, the keyboard rewrites text itself: predicting on top of it duplicates letters.
  let composing = false;
  const textarea = term.textarea;
  const start = (): void => ((composing = true), predictor.reset(), paint());
  const end = (): void => void (composing = false);
  textarea?.addEventListener('compositionstart', start);
  textarea?.addEventListener('compositionend', end);
  return {
    /** Call with every chunk the user types. */
    input(data: string): void {
      if (!composing && predictor.input(data)) paint();
    },
    /**
     * Call once server output has been written to the terminal. The screen is judged once output pauses:
     * a program redrawing its whole frame (tmux sends it in pieces) passes the cursor over other rows, and
     * judging there took a correct guess for a wrong one, which turned the local echo off.
     */
    written(): void {
      if (!predictor.hasPending()) return;
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        if (predictor.afterWrite() || predictor.hasPending()) paint();
      }, SETTLE_MS);
    },
    dispose(): void {
      window.clearTimeout(expiry);
      window.clearTimeout(settle);
      textarea?.removeEventListener('compositionstart', start);
      textarea?.removeEventListener('compositionend', end);
      overlay.clear();
    },
  };
}
