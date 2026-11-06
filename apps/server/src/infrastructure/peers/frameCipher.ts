import { createCipheriv, createDecipheriv } from 'node:crypto';

const TAG = 16;

/** The 96-bit nonce of message `n`: both sides count, so it never travels and never repeats. */
const nonce = (n: bigint): Buffer => {
  const iv = Buffer.alloc(12);
  iv.writeBigUInt64BE(n, 4);
  return iv;
};

/** Encrypts one direction's messages with ChaCha20-Poly1305. */
export function sealer(key: Buffer): (plain: Uint8Array) => Buffer {
  let count = 0n;
  return (plain) => {
    const cipher = createCipheriv('chacha20-poly1305', key, nonce(count++), { authTagLength: TAG });
    return Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
  };
}

/** Decrypts the other direction; throws on a forged, replayed, reordered or truncated message. */
export function opener(key: Buffer): (sealed: Uint8Array) => Buffer {
  let count = 0n;
  return (sealed) => {
    if (sealed.length < TAG) throw new Error('Message too short');
    const body = sealed.subarray(0, sealed.length - TAG);
    const decipher = createDecipheriv('chacha20-poly1305', key, nonce(count++), {
      authTagLength: TAG,
    });
    decipher.setAuthTag(sealed.subarray(sealed.length - TAG));
    return Buffer.concat([decipher.update(body), decipher.final()]);
  };
}

export type Head = Record<string, unknown>;

/** A frame on the wire: header length, JSON header, raw body bytes. */
export function encodeFrame(head: Head, body?: Uint8Array): Buffer {
  const json = Buffer.from(JSON.stringify(head), 'utf8');
  const size = Buffer.alloc(4);
  size.writeUInt32BE(json.length);
  return Buffer.concat(body ? [size, json, body] : [size, json]);
}

export function decodeFrame(bytes: Buffer): { head: Head; body: Buffer } {
  const size = bytes.readUInt32BE(0);
  const head: unknown = JSON.parse(bytes.subarray(4, 4 + size).toString('utf8'));
  if (typeof head !== 'object' || head === null || Array.isArray(head))
    throw new Error('Bad frame');
  return { head: head as Head, body: bytes.subarray(4 + size) };
}
