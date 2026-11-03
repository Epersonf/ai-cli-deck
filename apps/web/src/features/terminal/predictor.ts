import { RESET_KEYS, SECRET_PROMPT, isPredictable } from './predictorTypes';
import type { Prediction, PredictionView, PredictorOptions } from './predictorTypes';

export { isPredictable };
export type { Prediction, PredictionView, PredictorOptions, ScreenView } from './predictorTypes';

/**
 * Mosh-style local echo for a high-latency link. Typed characters are predicted at the
 * cursor and drawn as an overlay (never written to the terminal buffer); each one is checked
 * against the real screen when the server's output arrives. It only shows after the server has
 * echoed earlier predictions correctly, so password prompts and full-screen apps stay untouched.
 */
export function createPredictor(options: PredictorOptions) {
  const { screen } = options;
  const clock = options.clock ?? ((): number => performance.now());
  const threshold = options.threshold ?? 0;
  const trust = options.trust ?? 2;
  let pending: Prediction[] = [];
  /** Confirmations still required before showing again (0 = show at once). */
  let needs = 0;
  /** Characters typed on the current line (guards backspace over the prompt). */
  let lineTyped = 0;

  /** The echo differed from the guess: stop guessing until a few are confirmed again. */
  const give_up = (): void => {
    pending = [];
    needs = trust;
  };
  const timeout = (): number => Math.max(2000, (options.latency() ?? 0) * 4);
  const lineBefore = (x: number, y: number): string => {
    let text = '';
    for (let i = 0; i < x; i += 1) text += screen.cell(i, y) || ' ';
    return text;
  };
  const secretPrompt = (x: number, y: number): boolean => SECRET_PROMPT.test(lineBefore(x, y));
  const next = (): { x: number; y: number } => {
    const last = pending[pending.length - 1];
    if (!last) return screen.cursor();
    return { x: last.erase ? last.x : last.x + 1, y: last.y };
  };

  return {
    /** Feed every chunk of user input; returns true when the overlay changed. */
    input(data: string): boolean {
      if (isPredictable(data)) {
        if (screen.alternate() || !screen.atBottom()) {
          pending = [];
          return false;
        }
        const base = next();
        if (pending.length === 0) {
          // typing in the middle of a line makes the shell shift the text: not predictable
          if ((screen.cell(base.x, base.y) || ' ') !== ' ' || secretPrompt(base.x, base.y)) return false;
        }
        if (base.x >= screen.cols - 1) {
          pending = []; // line wrap behaviour is app-specific: stop guessing
          return true;
        }
        pending.push({ x: base.x, y: base.y, ch: data, at: clock() });
        lineTyped += 1;
        return true;
      }
      if (data === '\x7f') {
        const last = pending[pending.length - 1];
        if (last && !last.erase) {
          pending.pop(); // fix a typo that has not been echoed yet
          lineTyped = Math.max(0, lineTyped - 1);
          return true;
        }
        const base = next();
        if (lineTyped > 0 && base.x > 0 && !screen.alternate() && screen.atBottom()) {
          pending.push({ x: base.x - 1, y: base.y, ch: ' ', at: clock(), erase: true });
          lineTyped -= 1;
          return true;
        }
      }
      const had = pending.length > 0;
      pending = [];
      if (RESET_KEYS.has(data.charAt(0))) lineTyped = 0;
      return had;
    },

    /** Call after server output was written to the terminal; returns true when the overlay changed. */
    afterWrite(): boolean {
      let changed = false;
      const cursor = screen.cursor();
      for (let front = pending[0]; front !== undefined; front = pending[0]) {
        const moved = cursor.y !== front.y || (front.erase ? cursor.x <= front.x : cursor.x > front.x);
        if (!moved) break;
        if ((screen.cell(front.x, front.y) || ' ') === front.ch) {
          pending.shift();
          if (needs > 0) needs -= 1;
          changed = true;
        } else {
          give_up(); // the echo differs from the guess
          return true;
        }
      }
      return changed;
    },

    /** Drops predictions that never got an echo; returns true when the overlay changed. */
    tick(): boolean {
      const front = pending[0];
      if (!front || clock() - front.at < timeout()) return false;
      pending = []; // a slow server, not a wrong guess: no loss of trust
      return true;
    },

    reset(): void {
      pending = [];
    },

    hasPending: (): boolean => pending.length > 0,

    view(): PredictionView | null {
      const slow = (options.latency() ?? 0) >= threshold;
      if (!slow || needs > 0 || pending.length === 0) return null;
      if (screen.alternate() || !screen.atBottom()) return null;
      const end = next();
      return { chars: pending, cursor: end };
    },
  };
}
