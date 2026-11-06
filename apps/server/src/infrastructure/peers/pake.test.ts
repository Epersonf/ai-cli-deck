import { describe, expect, it } from 'vitest';
import { pakeAttempt, proof, sameProof } from './pake.js';

const transcript = Buffer.from('ids and nonces');

const must = (key: Buffer | null): Buffer => {
  if (!key) throw new Error('no key');
  return key;
};

describe('pairing PAKE', () => {
  it('gives both sides the same key with the same code', () => {
    const asker = pakeAttempt('482913', transcript);
    const shower = pakeAttempt('482913', transcript);
    const a = must(asker.finish(shower.share, 'mine'));
    const b = must(shower.finish(asker.share, 'theirs'));
    expect(sameProof(proof(a, 'asker'), proof(b, 'asker'))).toBe(true);
  });

  it('gives different keys with a different code or transcript', () => {
    const shower = pakeAttempt('482913', transcript);
    const wrong = pakeAttempt('482914', transcript);
    const other = pakeAttempt('482913', Buffer.from('another session'));
    const key = must(shower.finish(wrong.share, 'theirs'));
    expect(key.equals(must(wrong.finish(shower.share, 'mine')))).toBe(false);
    const mine = must(shower.finish(other.share, 'theirs'));
    expect(mine.equals(must(other.finish(shower.share, 'mine')))).toBe(false);
  });

  it('rejects a share that is not a point', () => {
    expect(pakeAttempt('1', transcript).finish(Buffer.alloc(32, 0xff), 'mine')).toBeNull();
    expect(pakeAttempt('1', transcript).finish(Buffer.alloc(32), 'mine')).toBeNull();
  });
});
