import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { signingKey, type SigningKey } from './keys.js';

/** A deck's id: short, stable, and derived from its key (so it cannot be claimed by another deck). */
export const peerIdOf = (publicKey: Uint8Array): string =>
  createHash('sha256').update(publicKey).digest('base64url').slice(0, 16);

/** This deck's signing key, created on first use and kept readable by the user only. */
export async function loadIdentity(file: string): Promise<SigningKey> {
  try {
    return signingKey(await readFile(file, 'utf8'));
  } catch {
    const key = signingKey();
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, key.pem(), { mode: 0o600 });
    return key;
  }
}
