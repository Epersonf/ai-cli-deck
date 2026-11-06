import { createHash, hkdfSync } from 'node:crypto';
import { NOT_PAIRED, established, type SecureLink } from './channel.js';
import { b64, bytesOf, inbox, type Msg } from './inbox.js';
import { ephemeralKey, verifySignature, type SigningKey } from './keys.js';
import type { Wire } from './wire.js';

export { NOT_PAIRED, type SecureLink };

const LABEL = 'clideck-link-v1';
const HANDSHAKE_MS = 10_000;

const transcript = (keys: Buffer[]): Buffer => {
  const hash = createHash('sha256').update(LABEL);
  for (const key of keys) hash.update(key);
  return hash.digest();
};

const portOf = (msg: Msg): number | null =>
  typeof msg.port === 'number' && Number.isInteger(msg.port) ? msg.port : null;

const deriveKeys = (shared: Buffer, th: Buffer): Buffer =>
  Buffer.from(hkdfSync('sha256', shared, th, 'clideck-link-keys', 64));

/** Opens a link to a deck whose key we pinned when pairing. */
export async function initiateLink(
  wire: Wire,
  me: SigningKey,
  expected: Buffer,
  myPort: number | null,
): Promise<SecureLink> {
  const box = inbox(wire);
  const eph = ephemeralKey();
  wire.send(
    JSON.stringify({
      t: 'hello',
      v: 1,
      key: b64(me.publicKey),
      eph: b64(eph.publicKey),
      port: myPort,
    }),
  );
  const welcome = await box.next(HANDSHAKE_MS);
  const theirKey = bytesOf(welcome, 'key');
  const theirEph = bytesOf(welcome, 'eph');
  const th = transcript([me.publicKey, theirKey, eph.publicKey, theirEph]);
  const signed = Buffer.concat([th, Buffer.from('R')]);
  if (!theirKey.equals(expected) || !verifySignature(theirKey, signed, bytesOf(welcome, 'sig'))) {
    wire.close(NOT_PAIRED, 'Unknown deck');
    throw new Error('The other deck is not the one paired with this one');
  }
  wire.send(
    JSON.stringify({ t: 'auth', sig: b64(me.sign(Buffer.concat([th, Buffer.from('I')]))) }),
  );
  return established(
    wire,
    box,
    deriveKeys(eph.agree(theirEph), th),
    true,
    theirKey,
    portOf(welcome),
  );
}

/** Answers a link from a deck; `known` says whether its key was paired. */
export async function acceptLink(
  wire: Wire,
  me: SigningKey,
  known: (key: Buffer) => boolean,
  myPort: number | null,
): Promise<SecureLink> {
  const box = inbox(wire);
  const hello = await box.next(HANDSHAKE_MS);
  const theirKey = bytesOf(hello, 'key');
  if (hello.t !== 'hello' || !known(theirKey)) {
    wire.close(NOT_PAIRED, 'Not paired');
    throw new Error('A deck that is not paired tried to connect');
  }
  const theirEph = bytesOf(hello, 'eph');
  const eph = ephemeralKey();
  const th = transcript([theirKey, me.publicKey, theirEph, eph.publicKey]);
  const sig = me.sign(Buffer.concat([th, Buffer.from('R')]));
  wire.send(
    JSON.stringify({
      t: 'welcome',
      key: b64(me.publicKey),
      eph: b64(eph.publicKey),
      sig: b64(sig),
      port: myPort,
    }),
  );
  const auth = await box.next(HANDSHAKE_MS);
  if (!verifySignature(theirKey, Buffer.concat([th, Buffer.from('I')]), bytesOf(auth, 'sig'))) {
    wire.close(NOT_PAIRED, 'Bad proof');
    throw new Error('A deck failed to prove its key');
  }
  return established(
    wire,
    box,
    deriveKeys(eph.agree(theirEph), th),
    false,
    theirKey,
    portOf(hello),
  );
}
