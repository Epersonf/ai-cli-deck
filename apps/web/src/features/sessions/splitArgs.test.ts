import { describe, expect, it } from 'vitest';
import { splitArgs } from './splitArgs';

describe('splitArgs', () => {
  it('splits on whitespace and keeps quoted groups together', () => {
    expect(splitArgs('--model fast "two words" \'x y\'')).toEqual([
      '--model',
      'fast',
      'two words',
      'x y',
    ]);
  });

  it('returns nothing for blank input', () => {
    expect(splitArgs('   ')).toEqual([]);
  });
});
