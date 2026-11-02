import { describe, expect, it } from 'vitest';
import { shortcutFor, targetSession, type KeyLike } from './shortcuts';

const key = (code: string, extra: Partial<KeyLike> = {}): KeyLike => ({
  code,
  altKey: true,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...extra,
});

describe('shortcutFor', () => {
  it('maps Alt+digit and Alt+brackets', () => {
    expect(shortcutFor(key('Digit1'))).toEqual({ kind: 'select', index: 0 });
    expect(shortcutFor(key('Digit9'))).toEqual({ kind: 'select', index: 8 });
    expect(shortcutFor(key('BracketLeft'))).toEqual({ kind: 'step', delta: -1 });
    expect(shortcutFor(key('BracketRight'))).toEqual({ kind: 'step', delta: 1 });
  });

  it('ignores other chords so shell and browser shortcuts keep working', () => {
    expect(shortcutFor(key('Digit1', { altKey: false }))).toBeNull();
    expect(shortcutFor(key('Digit1', { ctrlKey: true }))).toBeNull();
    expect(shortcutFor(key('Digit1', { shiftKey: true }))).toBeNull();
    expect(shortcutFor(key('Digit0'))).toBeNull();
    expect(shortcutFor(key('Period'))).toBeNull();
  });
});

describe('targetSession', () => {
  const ids = ['a', 'b', 'c'];
  it('selects by position and ignores positions that do not exist', () => {
    expect(targetSession({ kind: 'select', index: 1 }, ids, 'a')).toBe('b');
    expect(targetSession({ kind: 'select', index: 5 }, ids, 'a')).toBeNull();
    expect(targetSession({ kind: 'select', index: 0 }, [], null)).toBeNull();
  });

  it('steps with wrap-around and copes with no active session', () => {
    expect(targetSession({ kind: 'step', delta: 1 }, ids, 'c')).toBe('a');
    expect(targetSession({ kind: 'step', delta: -1 }, ids, 'a')).toBe('c');
    expect(targetSession({ kind: 'step', delta: 1 }, ids, null)).toBe('b');
  });
});
