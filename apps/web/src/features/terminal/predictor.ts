import { readScreen } from './predictorScreen';
import { AGENT_PROMPT, RESET_KEYS, isPredictable } from './predictorTypes';
import type { Prediction, PredictionView, PredictorOptions } from './predictorTypes';

export { isPredictable };
export type { Prediction, PredictionView, PredictorOptions, ScreenView } from './predictorTypes';

/**
 * Mosh-style local echo for a slow link or a busy program: typed characters are guessed at the cursor and
 * drawn as an overlay, checked against the screen as output arrives (a wrong guess just disappears), never
 * at a password prompt. On a full-screen program a guess shows after one confirmed echo, or at once in an
 * agent's chat box (its ❯ prompt or faint placeholder), where a CLI still starting up can be seconds late.
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
  /** The placeholder the guesses cover, and their row's text when last checked. */
  let mask: PredictionView['mask'] = null;
  let row = '';
  let wasAlternate = false;
  const clear = (): void => {
    pending = [];
    mask = null;
  };
  /** The echo differed from the guess: stop guessing until a few are confirmed again. */
  const give_up = (): void => {
    clear();
    needs = trust;
  };
  /** A busy program leaves the row alone, so guesses may wait a while (a redraw without them ends them). */
  const timeout = (): number => Math.max(8000, (options.latency() ?? 0) * 4);
  const { blank, rowText, secretPrompt } = readScreen(screen);
  const next = (): { x: number; y: number } => {
    const last = pending[pending.length - 1];
    if (!last) return screen.cursor();
    return { x: last.erase ? last.x : last.x + 1, y: last.y };
  };
  /** Starts a run of guesses; false in the middle of a line (the program shifts text) or at a password. */
  const start = (x: number, y: number): boolean => {
    if (!blank(x, y) || secretPrompt(x, y)) return false;
    row = rowText(y);
    // An input that shows its placeholder, or an agent's chat box: what is typed goes there.
    mask = screen.faint(x, y) ? { x, y, width: screen.cols - x } : null;
    if (mask || AGENT_PROMPT.test(row)) needs = 0;
    return true;
  };

  return {
    /** Feed every chunk of user input; returns true when the overlay changed. */
    input(data: string): boolean {
      const alternate = screen.alternate();
      if (alternate !== wasAlternate) {
        wasAlternate = alternate;
        if (alternate) needs = Math.max(needs, 1); // a new full-screen program: wait for one echo
      }
      if (isPredictable(data)) {
        if (!screen.atBottom()) {
          clear();
          return false;
        }
        const base = next();
        if (pending.length === 0 ? !start(base.x, base.y) : !blank(base.x, base.y)) return false;
        if (base.x >= screen.cols - 1) {
          clear(); // line wrap behaviour is app-specific: stop guessing
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
        if (lineTyped > 0 && base.x > 0 && !alternate && screen.atBottom()) {
          if (pending.length === 0) row = rowText(base.y);
          pending.push({ x: base.x - 1, y: base.y, ch: ' ', at: clock(), erase: true });
          lineTyped -= 1;
          return true;
        }
      }
      const had = pending.length > 0;
      clear();
      if (RESET_KEYS.has(data.charAt(0))) lineTyped = 0;
      return had;
    },

    /** Call after server output was written to the terminal; returns true when the overlay changed. */
    afterWrite(): boolean {
      let changed = false;
      const cursor = screen.cursor();
      for (let front = pending[0]; front !== undefined; front = pending[0]) {
        // The echo went elsewhere (the box wrapped the line, a menu opened): no wrong guess, just stop.
        if (cursor.y !== front.y) return (clear(), true);
        const moved = front.erase ? cursor.x <= front.x : cursor.x > front.x;
        if (!moved) break;
        if ((screen.cell(front.x, front.y) || ' ') !== front.ch) {
          give_up(); // the echo differs from the guess
          return true;
        }
        pending.shift();
        if (needs > 0) needs -= 1;
        changed = true;
      }
      const front = pending[0];
      if (changed) mask = null; // the program has taken over its input (and its placeholder)
      if (!front) return changed;
      const now = rowText(front.y);
      if (changed) row = now;
      else if (now !== row) {
        // The program redrew the row without the guesses: it uses those keys for something else.
        if (screen.alternate()) give_up();
        else clear();
        return true;
      }
      return changed;
    },

    /** Drops predictions that never got an echo; returns true when the overlay changed. */
    tick(): boolean {
      const front = pending[0];
      if (!front || clock() - front.at < timeout()) return false;
      // A slow link loses no trust; a full-screen program that never echoed is not guessed again soon.
      if (screen.alternate()) give_up();
      else clear();
      return true;
    },

    reset: clear,

    hasPending: (): boolean => pending.length > 0,

    view(): PredictionView | null {
      const slow = (options.latency() ?? 0) >= threshold;
      if (!slow || needs > 0 || pending.length === 0 || !screen.atBottom()) return null;
      return { chars: pending, cursor: next(), mask };
    },
  };
}
