import { decodeFrame, encodeFrame, opener, sealer, type Head } from './frameCipher.js';
import type { inbox } from './inbox.js';
import type { Wire } from './wire.js';

/** Closed because the other side is not paired, or failed to prove who it is. */
export const NOT_PAIRED = 4401;

/** An authenticated, encrypted channel to a paired deck, carrying frames (a JSON head and raw bytes). */
export interface SecureLink {
  /** The other deck's public signing key. */
  readonly peerKey: Buffer;
  /** The port the other deck accepts links on, when it shares itself. */
  readonly peerPort: number | null;
  send(head: Head, body?: Uint8Array): void;
  onFrame(listener: (head: Head, body: Buffer) => void): void;
  onClose(listener: () => void): void;
  close(): void;
  buffered(): number;
}

/** The link once both sides proved their keys: every message sealed with this direction's key. */
export function established(
  wire: Wire,
  box: ReturnType<typeof inbox>,
  keys: Buffer,
  initiator: boolean,
  peerKey: Buffer,
  peerPort: number | null,
): SecureLink {
  const seal = sealer(Buffer.from(keys.subarray(initiator ? 0 : 32, initiator ? 32 : 64)));
  const open = opener(Buffer.from(keys.subarray(initiator ? 32 : 0, initiator ? 64 : 32)));
  const pending: { head: Head; body: Buffer }[] = [];
  let listener: ((head: Head, body: Buffer) => void) | null = null;
  box.handOver((data) => {
    let frame;
    try {
      frame = decodeFrame(open(data));
    } catch {
      return wire.close(NOT_PAIRED, 'Bad message'); // forged or damaged: never trust the link again
    }
    if (listener) listener(frame.head, frame.body);
    else pending.push(frame);
  });
  return {
    peerKey,
    peerPort,
    send: (head, body) => wire.send(seal(encodeFrame(head, body))),
    onFrame(next) {
      listener = next;
      pending.splice(0).forEach((frame) => next(frame.head, frame.body));
    },
    onClose: (next) => wire.onClose(() => next()),
    close: () => wire.close(1000),
    buffered: () => wire.buffered(),
  };
}
