import { describe, expect, it } from 'vitest';
import { signingKey } from './keys.js';
import { acceptLink, initiateLink } from './secureLink.js';
import { memoryWires } from './wire.js';

const phone = signingKey();
const pc = signingKey();

describe('secure link', () => {
  it('connects two paired decks and carries frames both ways', async () => {
    const [a, b] = memoryWires();
    const [left, right] = await Promise.all([
      initiateLink(a, phone, pc.publicKey, null),
      acceptLink(b, pc, (key) => key.equals(phone.publicKey), 7850),
    ]);
    expect(left.peerPort).toBe(7850);
    expect(right.peerKey.equals(phone.publicKey)).toBe(true);
    const got: string[] = [];
    right.onFrame((head, body) => got.push(`${String(head.k)}:${body.toString()}`));
    left.onFrame((head) => got.push(`back:${String(head.k)}`));
    left.send({ k: 'one' }, Buffer.from('hello'));
    left.send({ k: 'two' });
    right.send({ k: 'pong' });
    await new Promise((r) => setTimeout(r, 10));
    expect(got.sort()).toEqual(['back:pong', 'one:hello', 'two:'].sort());
  });

  it('refuses a deck that was not paired', async () => {
    const [a, b] = memoryWires();
    const outcome = Promise.allSettled([
      initiateLink(a, phone, pc.publicKey, null),
      acceptLink(b, pc, () => false, null),
    ]);
    const [left, right] = await outcome;
    expect(left.status).toBe('rejected');
    expect(right.status).toBe('rejected');
  });

  it('refuses a deck that answers with another key', async () => {
    const stranger = signingKey();
    const [a, b] = memoryWires();
    const [left] = await Promise.allSettled([
      initiateLink(a, phone, pc.publicKey, null),
      acceptLink(b, stranger, () => true, null),
    ]);
    expect(left.status).toBe('rejected');
  });

  it('hangs up on a forged message', async () => {
    const [a, b] = memoryWires();
    let closed = false;
    b.onClose(() => (closed = true));
    const [, right] = await Promise.all([
      initiateLink(a, phone, pc.publicKey, null),
      acceptLink(b, pc, () => true, null),
    ]);
    right.onFrame(() => undefined);
    a.send(Buffer.alloc(40, 7));
    await new Promise((r) => setTimeout(r, 10));
    expect(closed).toBe(true);
  });
});
