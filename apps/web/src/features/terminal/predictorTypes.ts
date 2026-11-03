/** What the predictor needs to know about the real terminal screen. */
export interface ScreenView {
  cols: number;
  /** Cursor position inside the viewport (0-based). */
  cursor(): { x: number; y: number };
  /** Text of one cell ('' or ' ' when empty). */
  cell(x: number, y: number): string;
  /** True on the alternate screen (vim, less…), where typed keys are not echoed in place. */
  alternate(): boolean;
  /** False while the user has scrolled back into history. */
  atBottom(): boolean;
}

export interface Prediction {
  x: number;
  y: number;
  ch: string;
  at: number;
  /** A predicted backspace: the cell at (x, y) is expected to become blank. */
  erase?: boolean;
}

export interface PredictionView {
  chars: readonly Prediction[];
  /** Where the cursor will be once the echo arrives. */
  cursor: { x: number; y: number };
}

export interface PredictorOptions {
  screen: ScreenView;
  /** Current worst-case latency (ms) or null when unknown; predictions only show when it is high. */
  latency(): number | null;
  clock?(): number;
  /** Latency (ms) from which local echo is shown. 0 (default) = always, like typing over ssh. */
  threshold?: number;
  /** Echoes that must be confirmed after a wrong guess before predictions show again. */
  trust?: number;
}

/** Prompts whose input is not echoed: never guess there. */
export const SECRET_PROMPT =
  /(pass(word|phrase|code)?|senha|secret|token|pin|otp|2fa|verification code)[^\w]*[:?>]?\s*$/i;

/** A plain, single-width character that a shell or CLI input box echoes in place. */
export const isPredictable = (data: string): boolean => /^[ -~¡-ɏ]$/.test(data);

/** Enter, Ctrl-C/D/Z: what comes next on screen is unknown (a password prompt?), so trust restarts. */
export const RESET_KEYS = new Set(['\r', '\n', '\x03', '\x04', '\x1a']);
