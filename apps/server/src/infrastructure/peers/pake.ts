import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ristretto255, ristretto255_hasher } from '@noble/curves/ed25519.js';

/**
 * CPace-style PAKE over ristretto255 (draft-irtf-cfrg-cpace): both sides turn the pairing code and the
 * session transcript into a secret generator, swap one point each and derive the same key only when they
 * used the same code. Someone listening learns nothing; someone in the middle gets one guess per attempt.
 */
const DST = new TextEncoder().encode('clideck-pair-v1');
const { Point } = ristretto255;
const ORDER = Point.Fn.ORDER;

const scalar = (): bigint => {
  const n = BigInt(`0x${randomBytes(64).toString('hex')}`) % (ORDER - 1n);
  return n + 1n;
};

/** One side of one attempt: its share to send, and the key once the other share arrives. */
export interface PakeAttempt {
  readonly share: Buffer;
  /** The session key, or null when the other share is not a valid point. */
  finish(theirs: Uint8Array, first: 'mine' | 'theirs'): Buffer | null;
}

export function pakeAttempt(code: string, transcript: Uint8Array): PakeAttempt {
  const generator = ristretto255_hasher.hashToCurve(
    Buffer.concat([Buffer.from(code, 'utf8'), Buffer.from([0]), transcript]),
    { DST },
  );
  const secret = scalar();
  const share = Buffer.from(generator.multiply(secret).toBytes());
  return {
    share,
    finish(theirs, first) {
      let point;
      try {
        point = Point.fromBytes(theirs);
      } catch {
        return null;
      }
      if (point.is0()) return null;
      const shared = point.multiply(secret).toBytes();
      const [a, b] = first === 'mine' ? [share, theirs] : [theirs, share];
      return createHash('sha256')
        .update(DST)
        .update(transcript)
        .update(shared)
        .update(a)
        .update(b)
        .digest();
    },
  };
}

/** The proof that a side holds the key (`role` keeps the two proofs apart). */
export const proof = (key: Uint8Array, role: 'asker' | 'shower'): Buffer =>
  createHmac('sha256', key).update(role).digest();

export const sameProof = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && timingSafeEqual(a, b);
