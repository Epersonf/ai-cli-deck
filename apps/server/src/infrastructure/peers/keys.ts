import {
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  sign,
  verify,
  type KeyObject,
} from 'node:crypto';

/** DER prefixes that turn a raw 32-byte key into an SPKI public key Node can load. */
const SPKI = {
  ed25519: Buffer.from('302a300506032b6570032100', 'hex'),
  x25519: Buffer.from('302a300506032b656e032100', 'hex'),
};

const rawOf = (key: KeyObject): Buffer => key.export({ format: 'der', type: 'spki' }).subarray(-32);

const publicOf = (kind: keyof typeof SPKI, raw: Uint8Array): KeyObject => {
  if (raw.length !== 32) throw new Error('A key is 32 bytes');
  return createPublicKey({ key: Buffer.concat([SPKI[kind], raw]), format: 'der', type: 'spki' });
};

/** A deck's long-term signing key (Ed25519); the other side pins its public half when pairing. */
export interface SigningKey {
  readonly publicKey: Buffer;
  sign(data: Uint8Array): Buffer;
  /** PKCS#8 PEM, to keep on disk. */
  pem(): string;
}

export function signingKey(pem?: string): SigningKey {
  const privateKey = pem ? createPrivateKey(pem) : generateKeyPairSync('ed25519').privateKey;
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('Not an Ed25519 key');
  const publicKey = rawOf(createPublicKey(privateKey));
  return {
    publicKey,
    sign: (data) => sign(null, data, privateKey),
    pem: () => privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
  };
}

export function verifySignature(publicKey: Uint8Array, data: Uint8Array, sig: Uint8Array): boolean {
  try {
    return verify(null, data, publicOf('ed25519', publicKey), sig);
  } catch {
    return false;
  }
}

/** A one-connection X25519 key: forward secrecy for every link. */
export function ephemeralKey(): { publicKey: Buffer; agree(theirs: Uint8Array): Buffer } {
  const pair = generateKeyPairSync('x25519');
  return {
    publicKey: rawOf(pair.publicKey),
    agree: (theirs) =>
      diffieHellman({ privateKey: pair.privateKey, publicKey: publicOf('x25519', theirs) }),
  };
}
