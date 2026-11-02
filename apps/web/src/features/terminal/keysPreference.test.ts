import { describe, expect, it } from 'vitest';
import { keysVisible, nextMode } from './keysPreference';

describe('keys preference', () => {
  it('cycles auto -> on -> off -> auto', () => {
    expect(nextMode('auto')).toBe('on');
    expect(nextMode('on')).toBe('off');
    expect(nextMode('off')).toBe('auto');
  });

  it('auto follows the touch screen, on/off force the choice', () => {
    expect(keysVisible('auto', true)).toBe(true);
    expect(keysVisible('auto', false)).toBe(false);
    expect(keysVisible('on', false)).toBe(true);
    expect(keysVisible('off', true)).toBe(false);
  });
});
