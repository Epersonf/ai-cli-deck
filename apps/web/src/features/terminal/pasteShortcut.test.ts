import { describe, expect, it } from 'vitest';
import { isPasteShortcut } from './pasteShortcut';

const key = (key: string, mods: Partial<KeyboardEvent> = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
});

describe('isPasteShortcut', () => {
  it('matches Ctrl+V, Cmd+V and Ctrl+Shift+V', () => {
    expect(isPasteShortcut(key('v', { ctrlKey: true }))).toBe(true);
    expect(isPasteShortcut(key('v', { metaKey: true }))).toBe(true);
    expect(isPasteShortcut(key('V', { ctrlKey: true }))).toBe(true);
  });

  it('leaves everything else alone', () => {
    expect(isPasteShortcut(key('v'))).toBe(false);
    expect(isPasteShortcut(key('c', { ctrlKey: true }))).toBe(false);
    expect(isPasteShortcut(key('v', { ctrlKey: true, altKey: true }))).toBe(false);
  });
});
