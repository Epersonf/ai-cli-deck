import type { Terminal } from '@xterm/xterm';

type KeyboardTerm = Pick<Terminal, 'textarea' | 'element' | 'input'>;

/** Past this many characters the text box is emptied (between words), so the diffs stay short. */
const MAX_TEXT = 200;
const isLead = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;

/** What to type so the line goes from `before` to `after`: backspaces over what changed, then the new text. */
export function textChange(before: string, after: string): string {
  let same = 0;
  const max = Math.min(before.length, after.length);
  while (same < max && before[same] === after[same]) same += 1;
  if (same > 0 && isLead(before.charCodeAt(same - 1))) same -= 1; // never split an emoji
  const removed = [...before.slice(same)].length;
  return '\x7f'.repeat(removed) + after.slice(same).replace(/\r?\n/g, '\r');
}

/** Mobile keyboards: no autocorrect/suggestions where the keyboard honours it, and its text read as a diff. */
export function tameMobileKeyboard(term: KeyboardTerm, touch = isTouch()): () => void {
  const input = term.textarea;
  if (!input) return () => undefined;
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('enterkeyhint', 'send');
  return touch ? readTextAsDiff(term, input) : () => undefined;
}

const isTouch = (): boolean => window.matchMedia?.('(pointer: coarse)').matches ?? false;

/**
 * A phone keyboard edits the text box (composing a word, swapping in a suggestion, autocorrecting the last
 * word) and xterm reads those edits twice: once when the composition ends and again from the insert event,
 * so a picked suggestion arrived doubled. Here the box is the source of truth: each change is sent as
 * backspaces plus the new text, so a word typed letter by letter shows at once and a replaced word is fixed
 * in place. Real key presses (Enter, or Backspace on an empty box) still go through xterm.
 */
function readTextAsDiff(term: KeyboardTerm, input: HTMLTextAreaElement): () => void {
  const root = term.element;
  if (!root) return () => undefined;
  let sent = input.value;
  let composing = false;
  let realKey = false;
  const restart = (): void => {
    input.value = '';
    sent = '';
  };
  const sync = (): void => {
    const value = input.value;
    const data = realKey ? '' : textChange(sent, value);
    sent = value;
    if (value.includes('\n') || (!composing && value.length > MAX_TEXT)) restart();
    if (data) term.input(data, true);
  };
  const ours = (event: Event): boolean => event.target === input;
  const onKey = (event: KeyboardEvent): void => {
    if (!ours(event)) return;
    if (event.keyCode === 229) {
      event.stopPropagation(); // the keyboard's own edit: the input event below reads it
      return;
    }
    realKey = true; // xterm sends this key itself; the box no longer matches the line
    window.setTimeout(() => ((realKey = false), restart()));
  };
  const onComposition = (event: CompositionEvent): void => {
    if (!ours(event)) return;
    event.stopPropagation();
    composing = event.type !== 'compositionend';
    if (!composing) sync();
  };
  const onInput = (event: Event): void => {
    if (!ours(event)) return;
    event.stopPropagation();
    sync();
  };
  const events = ['compositionstart', 'compositionupdate', 'compositionend'] as const;
  root.addEventListener('keydown', onKey, true);
  root.addEventListener('input', onInput, true);
  for (const type of events) root.addEventListener(type, onComposition, true);
  return () => {
    root.removeEventListener('keydown', onKey, true);
    root.removeEventListener('input', onInput, true);
    for (const type of events) root.removeEventListener(type, onComposition, true);
  };
}
