import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { OTP } from '@deck/shared';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const SECRET_BYTES = 20;

/** RFC 4648 base32 without padding. */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** Decodes base32 (any case, spaces, dashes and padding ignored); null when it holds other characters. */
export function base32Decode(text: string): Buffer | null {
  const clean = text.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const at = ALPHABET.indexOf(char);
    if (at < 0) return null;
    value = (value << 5) | at;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new random secret, 160 bits, as base32. */
export const newSecret = (random: (n: number) => Buffer = randomBytes): string =>
  base32Encode(random(SECRET_BYTES));

/** RFC 4226 HOTP with SHA-1 for a counter. */
function hotp(key: Buffer, counter: number, digits: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac('sha1', key).update(message).digest();
  const at = (mac[mac.length - 1] ?? 0) & 15;
  const binary = mac.readUInt32BE(at) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, '0');
}

const stepOf = (nowMs: number): number => Math.floor(nowMs / 1000 / OTP.stepSeconds);

/** The code of a secret at a moment (RFC 6238: 6 digits, 30 s steps, SHA-1 unless told otherwise). */
export function totpCode(secret: string, nowMs: number, digits: number = OTP.digits): string {
  return hotp(base32Decode(secret) ?? Buffer.alloc(0), stepOf(nowMs), digits);
}

/** Seconds before the current code changes. */
export const secondsLeft = (nowMs: number): number =>
  OTP.stepSeconds - (Math.floor(nowMs / 1000) % OTP.stepSeconds);

/**
 * True when `code` is the code of the previous, current or next step (clocks drift). Every step is compared
 * in constant time, and all three are always computed so the answer does not show which one matched.
 */
export function checkTotp(secret: string, code: string, nowMs: number): boolean {
  const key = base32Decode(secret);
  if (!key || !/^\d{6}$/.test(code)) return false;
  const given = Buffer.from(code);
  let ok = false;
  for (const offset of [-1, 0, 1]) {
    const expected = Buffer.from(hotp(key, stepOf(nowMs) + offset, OTP.digits));
    ok = timingSafeEqual(expected, given) || ok;
  }
  return ok;
}

/** The `otpauth://` address an authenticator app reads from a QR code. */
export function otpauthUri(secret: string, label: string): string {
  const name = encodeURIComponent(label);
  return `otpauth://totp/${name}?secret=${secret}&issuer=AI%20CLI%20Deck&digits=${OTP.digits}&period=${OTP.stepSeconds}`;
}
