import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { PasswordHash, PasswordHasherPort } from '../../domain/auth.js';

const KEY_LENGTH = 32;

export class ScryptHasher implements PasswordHasherPort {
  hash(password: string): PasswordHash {
    const salt = randomBytes(16).toString('hex');
    return { salt, hash: scryptSync(password, salt, KEY_LENGTH).toString('hex') };
  }

  verify(password: string, stored: PasswordHash): boolean {
    const candidate = scryptSync(password, stored.salt, KEY_LENGTH);
    const expected = Buffer.from(stored.hash, 'hex');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  }
}
