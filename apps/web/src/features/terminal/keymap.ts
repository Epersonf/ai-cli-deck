export interface Modifiers {
  ctrl: boolean;
  alt: boolean;
}

export const NO_MODS: Modifiers = { ctrl: false, alt: false };

export interface SequenceOptions {
  /** True when the app enabled DECCKM (application cursor keys), e.g. inside tmux or vim. */
  applicationCursor: boolean;
}

const CURSOR_KEYS: Readonly<Record<string, string>> = {
  UP: 'A',
  DOWN: 'B',
  RIGHT: 'C',
  LEFT: 'D',
  HOME: 'H',
  END: 'F',
};
const TILDE_KEYS: Readonly<Record<string, number>> = { PGUP: 5, PGDN: 6 };
const CONTROL_SYMBOLS: Readonly<Record<string, number>> = {
  '@': 0,
  ' ': 0,
  '[': 27,
  '\\': 28,
  ']': 29,
  '^': 30,
  _: 31,
  '?': 127,
};
const ESC = '\x1b';

/** xterm modifier parameter: 1 + shift(1) + alt(2) + ctrl(4). */
const modifierParam = (mods: Modifiers): number => 1 + (mods.alt ? 2 : 0) + (mods.ctrl ? 4 : 0);
const anyMod = (mods: Modifiers): boolean => mods.ctrl || mods.alt;

export function controlChar(char: string): string | null {
  const symbol = CONTROL_SYMBOLS[char];
  if (symbol !== undefined) return String.fromCharCode(symbol);
  return /^[a-zA-Z]$/.test(char)
    ? String.fromCharCode(char.toUpperCase().charCodeAt(0) & 0x1f)
    : null;
}

/** Applies armed CTRL/ALT to one typed character (pastes and sequences pass through). */
export function applyModifiersToText(text: string, mods: Modifiers): string {
  if (text.length !== 1 || !anyMod(mods)) return text;
  const base = mods.ctrl ? (controlChar(text) ?? text) : text;
  return mods.alt ? ESC + base : base;
}

/** Bytes to send for a key of the extra-keys bar. */
export function sequenceFor(key: string, mods: Modifiers, options: SequenceOptions): string {
  const cursor = CURSOR_KEYS[key];
  if (cursor !== undefined) {
    if (anyMod(mods)) return `${ESC}[1;${modifierParam(mods)}${cursor}`;
    return `${ESC}${options.applicationCursor ? 'O' : '['}${cursor}`;
  }
  const tilde = TILDE_KEYS[key];
  if (tilde !== undefined) {
    return anyMod(mods) ? `${ESC}[${tilde};${modifierParam(mods)}~` : `${ESC}[${tilde}~`;
  }
  if (key === 'ESC') return ESC;
  if (key === 'TAB') return mods.alt ? `${ESC}\t` : '\t';
  return applyModifiersToText(key, mods);
}
