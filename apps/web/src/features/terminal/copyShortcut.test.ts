import { describe, expect, it } from 'vitest';
import { isCopyShortcut } from './copyShortcut';

const press = (
  key: string,
  mods: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey', boolean>>,
) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe('isCopyShortcut', () => {
  it('copies with Ctrl+C only while text is selected', () => {
    expect(isCopyShortcut(press('c', { ctrlKey: true }), true)).toBe(true);
    expect(isCopyShortcut(press('c', { ctrlKey: true }), false)).toBe(false);
  });

  it('always copies with Ctrl+Shift+C, also on the Mac Cmd key', () => {
    expect(isCopyShortcut(press('C', { ctrlKey: true, shiftKey: true }), false)).toBe(true);
    expect(isCopyShortcut(press('c', { metaKey: true, shiftKey: true }), false)).toBe(true);
  });

  it('ignores other keys and Alt combinations', () => {
    expect(isCopyShortcut(press('v', { ctrlKey: true }), true)).toBe(false);
    expect(isCopyShortcut(press('c', { ctrlKey: true, altKey: true }), true)).toBe(false);
    expect(isCopyShortcut(press('c', {}), true)).toBe(false);
  });
});
