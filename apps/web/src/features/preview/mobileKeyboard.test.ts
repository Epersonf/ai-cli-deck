import { describe, expect, it } from 'vitest';
import { textChange } from './mobileKeyboard';

describe('textChange', () => {
  it('types what was added and backspaces over what was replaced', () => {
    expect(textChange('hel', 'hello ')).toBe('lo ');
    expect(textChange('teh', 'the ')).toBe('\x7f\x7fhe ');
    expect(textChange('abc', 'ab')).toBe('\x7f');
    expect(textChange('a😀', 'a😃')).toBe('\x7f😃');
    expect(textChange('', 'ok\n')).toBe('ok\r');
  });
});
