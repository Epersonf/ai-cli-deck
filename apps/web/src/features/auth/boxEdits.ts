export const DIGITS = 6;

export interface BoxEdit {
  /** The six boxes after the edit (a box is empty or one digit). */
  boxes: string[];
  /** The box to focus next. */
  focus: number;
}

export const emptyBoxes = (): string[] => Array.from({ length: DIGITS }, () => '');

/** Boxes from a stored value. */
export const toBoxes = (value: string): string[] =>
  Array.from({ length: DIGITS }, (_, i) => value[i] ?? '');

export const joinBoxes = (boxes: readonly string[]): string => boxes.join('');
export const isComplete = (boxes: readonly string[]): boolean => joinBoxes(boxes).length === DIGITS;

const digitsOf = (text: string): string => text.replace(/\D/g, '');

/** Typing into box `at`: keeps the last digit typed, then moves on. Non-digits are ignored. */
export function typeDigit(boxes: readonly string[], at: number, raw: string): BoxEdit {
  const digit = digitsOf(raw).slice(-1);
  const next = [...boxes];
  next[at] = digit;
  return { boxes: next, focus: digit === '' ? at : Math.min(at + 1, DIGITS - 1) };
}

/** Pasting fills from box `at`; a full six-digit code always fills all the boxes from the first. */
export function pasteDigits(boxes: readonly string[], at: number, text: string): BoxEdit {
  const digits = digitsOf(text).slice(0, DIGITS);
  if (digits === '') return { boxes: [...boxes], focus: at };
  const full = digits.length >= DIGITS;
  const next = full ? emptyBoxes() : [...boxes];
  const start = full ? 0 : at;
  [...digits].forEach((d, i) => {
    if (start + i < DIGITS) next[start + i] = d;
  });
  return { boxes: next, focus: Math.min(start + digits.length, DIGITS - 1) };
}

/** Backspace: clears this box, or when it is already empty, steps back and clears the one before. */
export function backspace(boxes: readonly string[], at: number): BoxEdit {
  const next = [...boxes];
  if (next[at] !== '') {
    next[at] = '';
    return { boxes: next, focus: at };
  }
  const prev = Math.max(at - 1, 0);
  next[prev] = '';
  return { boxes: next, focus: prev };
}

/** Left and right arrows move between boxes without leaving the row. */
export const moveFocus = (at: number, key: string): number =>
  key === 'ArrowLeft'
    ? Math.max(at - 1, 0)
    : key === 'ArrowRight'
      ? Math.min(at + 1, DIGITS - 1)
      : at;
