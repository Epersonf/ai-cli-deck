import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  checkTotp,
  newSecret,
  otpauthUri,
  secondsLeft,
  totpCode,
} from './totp.js';

// RFC 6238 appendix B: the SHA-1 secret is the ASCII text 12345678901234567890.
const SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('base32', () => {
  it('round-trips and tolerates case, spaces and padding', () => {
    expect(SECRET).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(base32Decode(SECRET)?.toString()).toBe('12345678901234567890');
    expect(base32Decode('gezd gnbv-GY3TQOJQ====')?.toString()).toBe('1234567890');
    expect(base32Decode('not base32!')).toBeNull();
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
  });
  it('makes a 160-bit secret from random bytes', () => {
    expect(newSecret(() => Buffer.alloc(20, 7))).toHaveLength(32);
    expect(newSecret()).not.toBe(newSecret());
  });
});

describe('TOTP (RFC 6238, SHA-1)', () => {
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ])('gives the vector for t=%i', (t, eight) => {
    expect(totpCode(SECRET, t * 1000, 8)).toBe(eight);
    expect(totpCode(SECRET, t * 1000)).toBe(eight.slice(2));
  });

  it('accepts the previous, current and next step only', () => {
    const now = 1_234_567_890_000;
    for (const step of [-1, 0, 1])
      expect(checkTotp(SECRET, totpCode(SECRET, now + step * 30_000), now)).toBe(true);
    for (const step of [-2, 2])
      expect(checkTotp(SECRET, totpCode(SECRET, now + step * 30_000), now)).toBe(false);
  });

  it('refuses malformed codes and secrets', () => {
    expect(checkTotp(SECRET, '12345', 0)).toBe(false);
    expect(checkTotp(SECRET, 'abcdef', 0)).toBe(false);
    expect(checkTotp('!!!', '123456', 0)).toBe(false);
  });

  it('counts the seconds left and builds the otpauth address', () => {
    expect(secondsLeft(1_000 * 60)).toBe(30);
    expect(secondsLeft(1_000 * 89)).toBe(1);
    expect(otpauthUri('ABC', 'AI CLI Deck:pc')).toBe(
      'otpauth://totp/AI%20CLI%20Deck%3Apc?secret=ABC&issuer=AI%20CLI%20Deck&digits=6&period=30',
    );
  });
});
