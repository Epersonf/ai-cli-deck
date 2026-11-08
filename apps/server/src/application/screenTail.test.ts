import { describe, expect, it } from 'vitest';
import { screenTail } from './screenTail';

describe('screenTail', () => {
  it('keeps the last lines that have words, without colours or borders', () => {
    const screen = '\x1b[32mone\x1b[0m\r\n──────\r\n\r\ntwo\r\n│ │\r\nthree\r\nfour\r\n';
    expect(screenTail(screen)).toBe('two\nthree\nfour');
  });

  it('is empty for an empty screen and cut to the limit', () => {
    expect(screenTail('')).toBe('');
    expect(screenTail('a'.repeat(500)).length).toBe(300);
  });
});
