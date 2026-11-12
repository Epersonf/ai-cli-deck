import { describe, expect, it } from 'vitest';
import { formatCode, formatSecret, qrPath, QUIET } from './otpFormat';

describe('otp format', () => {
  it('groups the secret by four', () => {
    expect(formatSecret('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP');
    expect(formatSecret('ABCDEF')).toBe('ABCD EF');
    expect(formatSecret('')).toBe('');
  });

  it('splits a code in two halves', () => {
    expect(formatCode('123456')).toBe('123 456');
    expect(formatCode('12')).toBe('12');
  });

  it('draws a QR code with a quiet zone and dark squares', () => {
    const { size, d } = qrPath('otpauth://totp/Deck:me?secret=JBSWY3DPEHPK3PXP&issuer=Deck');
    expect(size).toBeGreaterThan(21 + QUIET * 2 - 1);
    expect(d.startsWith('M')).toBe(true);
    // the first finder pattern starts at the first module, right inside the quiet zone
    expect(d).toContain(`M${QUIET} ${QUIET}h1v1h-1z`);
  });
});
