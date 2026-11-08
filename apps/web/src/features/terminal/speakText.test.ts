import { describe, expect, it } from 'vitest';
import { speakable } from './speakText';

describe('speakable', () => {
  it('drops borders and symbols, keeps the words, and cuts to the end', () => {
    expect(speakable('╭──────╮\r\n│ Done: 3 tests ✓ │\r\n╰──────╯\r\n> ok')).toBe(
      'Done: 3 tests. ok',
    );
    expect(speakable('x '.repeat(1000), 50).length).toBeLessThanOrEqual(50);
  });
});
