import { describe, expect, it } from 'vitest';
import { changedFolders, labelOf, toneOf } from './gitMarks';

describe('git marks', () => {
  it('maps status codes to tones', () => {
    expect(toneOf('M')).toBe('modified');
    expect(toneOf('MM')).toBe('modified');
    expect(toneOf('??')).toBe('added');
    expect(toneOf('A')).toBe('added');
    expect(toneOf('D')).toBe('deleted');
    expect(toneOf('UU')).toBe('deleted');
    expect(toneOf('R')).toBe('other');
  });
  it('labels untracked files with U', () => {
    expect(labelOf('??')).toBe('U');
    expect(labelOf('M')).toBe('M');
  });
  it('lists every ancestor folder of a change', () => {
    expect([...changedFolders(['a/b/c.ts', 'top.ts', 'x/y.ts'])].sort()).toEqual(['a', 'a/b', 'x']);
  });
});
