import { createHash, randomBytes } from 'node:crypto';
import { b64, bytesOf, inbox, type Msg } from './inbox.js';
import type { SigningKey } from './keys.js';
import { pakeAttempt, proof, sameProof } from './pake.js';
import type { Wire } from './wire.js';
import type { ShownCode } from '../../domain/network.js';

export type { ShownCode };

const LABEL = 'clideck-pair-v1';
/** Wrong codes allowed before the request ends (each is one online guess in a million). */
export const PAIR_ATTEMPTS = 3;
/** How long a code stays valid. */
export const PAIR_TTL_MS = 3 * 60_000;
const REPLY_MS = 15_000;

/** Who is on the other side of a pairing, as it introduced itself (its key is proven by the code). */
export interface PairedWith {
  key: Buffer;
  name: string;
  port: number | null;
}

const transcript = (askerKey: Buffer, showerKey: Buffer, askerNonce: Buffer, showerNonce: Buffer) =>
  createHash('sha256')
    .update(LABEL)
    .update(askerKey)
    .update(showerKey)
    .update(askerNonce)
    .update(showerNonce)
    .digest();

const nameOf = (msg: Msg): string =>
  typeof msg.name === 'string' ? msg.name.replace(/\p{Cc}/gu, '').slice(0, 60) : 'deck';
const portOf = (msg: Msg): number | null =>
  typeof msg.port === 'number' && Number.isInteger(msg.port) ? msg.port : null;

export interface Me {
  key: SigningKey;
  name: string;
  port: number | null;
}

/** The deck that shows the code: waits for the asker to prove it typed it. */
export async function showPairing(
  wire: Wire,
  me: Me,
  show: (asker: { name: string; key: Buffer }) => ShownCode,
): Promise<PairedWith> {
  const box = inbox(wire);
  const ask = await box.next(REPLY_MS);
  if (ask.t !== 'pair') throw new Error('Not a pairing request');
  const asker = { key: bytesOf(ask, 'key'), name: nameOf(ask), port: portOf(ask) };
  const shown = show(asker);
  shown.onCancel(() => wire.close(4403, 'Refused'));
  const nonce = randomBytes(16);
  const th = transcript(asker.key, me.key.publicKey, bytesOf(ask, 'nonce'), nonce);
  let attempt = pakeAttempt(shown.code, th);
  wire.send(
    JSON.stringify({
      t: 'code',
      key: b64(me.key.publicKey),
      name: me.name,
      nonce: b64(nonce),
      share: b64(attempt.share),
      port: me.port,
    }),
  );
  let guessed = false;
  try {
    for (let left = PAIR_ATTEMPTS - 1; ; left -= 1) {
      const prove = await box.next(PAIR_TTL_MS);
      const key = attempt.finish(bytesOf(prove, 'share'), 'theirs');
      if (key && sameProof(proof(key, 'asker'), bytesOf(prove, 'mac'))) {
        wire.send(JSON.stringify({ t: 'ok', mac: b64(proof(key, 'shower')) }));
        shown.done('paired');
        return asker;
      }
      guessed = true;
      if (left === 0) throw new Error('Wrong code');
      attempt = pakeAttempt(shown.code, th);
      wire.send(JSON.stringify({ t: 'retry', share: b64(attempt.share), left }));
    }
  } catch (error) {
    wire.send(JSON.stringify({ t: 'fail' }));
    shown.done(guessed ? 'wrong' : 'abandoned');
    throw error;
  }
}

/** The asking side, once the other deck shows a code: `submit` tries what the user typed. */
export interface PairingAsk extends PairedWith {
  submit(code: string): Promise<{ left: number } | null>;
  close(): void;
}

/** The deck that asks: introduces itself, then proves the code the user read on the other screen. */
export async function askPairing(wire: Wire, me: Me): Promise<PairingAsk> {
  const box = inbox(wire);
  const nonce = randomBytes(16);
  const hello = { t: 'pair', v: 1, key: b64(me.key.publicKey), name: me.name, nonce: b64(nonce) };
  wire.send(JSON.stringify({ ...hello, port: me.port }));
  const code = await box.next(REPLY_MS);
  if (code.t !== 'code') throw new Error('The other deck does not accept pairing');
  const shower = { key: bytesOf(code, 'key'), name: nameOf(code), port: portOf(code) };
  const th = transcript(me.key.publicKey, shower.key, nonce, bytesOf(code, 'nonce'));
  let share = bytesOf(code, 'share');
  return {
    ...shower,
    close: () => wire.close(1000),
    async submit(typed) {
      const attempt = pakeAttempt(typed, th);
      const key = attempt.finish(share, 'mine');
      if (!key) throw new Error('The other deck sent a broken message');
      wire.send(
        JSON.stringify({ t: 'prove', share: b64(attempt.share), mac: b64(proof(key, 'asker')) }),
      );
      const reply = await box.next(REPLY_MS);
      if (reply.t === 'retry') {
        share = bytesOf(reply, 'share');
        return { left: typeof reply.left === 'number' ? reply.left : 0 };
      }
      if (reply.t !== 'ok') throw new Error('Wrong code');
      if (!sameProof(proof(key, 'shower'), bytesOf(reply, 'mac'))) {
        throw new Error('The other deck could not prove the code');
      }
      return null;
    },
  };
}
