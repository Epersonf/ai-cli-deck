// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { tameMobileKeyboard, textChange } from './mobileKeyboard';

function phone() {
  const element = document.createElement('div');
  const textarea = document.createElement('textarea');
  element.append(textarea);
  const sent: string[] = [];
  const xterm = vi.fn(); // what xterm's own listeners would have seen
  for (const type of ['input', 'compositionend', 'keydown'])
    textarea.addEventListener(type, xterm, true);
  const term = { element, textarea, input: (data: string) => void sent.push(data) };
  tameMobileKeyboard(term as never, true);
  const fire = (event: Event): void => void textarea.dispatchEvent(event);
  return {
    sent,
    xterm,
    /** The keyboard sets the box to `value`, as Gboard does while composing or picking a suggestion. */
    key: (keyCode: number): void =>
      fire(new KeyboardEvent('keydown', { keyCode, bubbles: true } as KeyboardEventInit)),
    edit(value: string, inputType = 'insertCompositionText'): void {
      fire(new KeyboardEvent('keydown', { keyCode: 229, bubbles: true } as KeyboardEventInit));
      textarea.value = value;
      fire(new InputEvent('input', { inputType, bubbles: true }));
    },
    compose: (type: string): void => fire(new CompositionEvent(type, { bubbles: true })),
  };
}

describe('textChange', () => {
  it('types what was added and backspaces over what was replaced', () => {
    expect(textChange('hel', 'hello ')).toBe('lo ');
    expect(textChange('teh', 'the ')).toBe('\x7f\x7fhe ');
    expect(textChange('abc', 'ab')).toBe('\x7f');
    expect(textChange('a😀', 'a😃')).toBe('\x7f😃');
    expect(textChange('', 'ok\n')).toBe('ok\r');
  });
});

describe('a phone keyboard', () => {
  it('sends a picked suggestion once, and xterm never sees the edits', () => {
    const k = phone();
    k.compose('compositionstart');
    for (const word of ['h', 'he', 'hel']) k.edit(word);
    k.edit('hello ', 'insertText'); // the suggestion
    k.compose('compositionend');
    expect(k.sent.join('')).toBe('hello ');
    expect(k.xterm).not.toHaveBeenCalled();
  });

  it('fixes an autocorrected word in place', () => {
    const k = phone();
    k.edit('teh');
    k.edit('the ');
    expect(k.sent).toEqual(['teh', '\x7f\x7fhe ']);
  });

  it('leaves real keys to xterm, then starts the box afresh', () => {
    vi.useFakeTimers();
    const k = phone();
    k.edit('ls');
    k.key(13); // Enter: xterm sends it
    expect(k.xterm).toHaveBeenCalledTimes(1);
    vi.runAllTimers();
    vi.useRealTimers();
    k.edit('a');
    expect(k.sent).toEqual(['ls', 'a']);
  });
});
