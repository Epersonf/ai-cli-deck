import type { Terminal } from '@xterm/xterm';

/** Mobile keyboards: no autocorrect/suggestions, so the IME doesn't re-send the word it is completing. */
export function tameMobileKeyboard(term: Terminal): void {
  const input = term.textarea;
  if (!input) return;
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('enterkeyhint', 'send');
}
