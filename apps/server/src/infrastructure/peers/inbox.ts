import type { Wire } from './wire.js';

export type Msg = Record<string, unknown>;

/** Why the other deck closed, in words (4401: it does not know this deck; 4403: the user refused). */
const hangUp = (code: number): string =>
  code === 4401
    ? 'That deck does not know this one any more: pair them again'
    : code === 4403
      ? 'The other deck refused'
      : 'The other deck hung up';

/** Handshake messages are awaited one by one; afterwards the wire is handed over to a listener. */
export function inbox(wire: Wire) {
  const queue: Buffer[] = [];
  const waiting: ((data: Buffer | null) => void)[] = [];
  let closed = false;
  let closeCode = 0;
  let tap: ((data: Buffer) => void) | null = null;
  wire.onMessage((data) => {
    if (tap) return tap(data);
    const waiter = waiting.shift();
    if (waiter) waiter(data);
    else queue.push(data);
  });
  wire.onClose((code) => {
    closed = true;
    closeCode = code;
    waiting.splice(0).forEach((waiter) => waiter(null));
  });

  return {
    /** The next JSON message; rejects when the wire closes or nothing comes in time. */
    next(timeoutMs: number): Promise<Msg> {
      const queued = queue.shift();
      const data = queued
        ? Promise.resolve(queued)
        : closed
          ? Promise.resolve(null)
          : new Promise<Buffer | null>((resolve) => {
              const timer = setTimeout(() => {
                const index = waiting.indexOf(done);
                if (index >= 0) waiting.splice(index, 1);
                resolve(null);
              }, timeoutMs);
              const done = (value: Buffer | null): void => (clearTimeout(timer), resolve(value));
              waiting.push(done);
            });
      return data.then((bytes) => {
        if (bytes === null)
          throw new Error(closed ? hangUp(closeCode) : 'No answer in time');
        const parsed: unknown = JSON.parse(bytes.toString('utf8'));
        if (typeof parsed !== 'object' || parsed === null) throw new Error('Unexpected message');
        return parsed as Msg;
      });
    },
    /** Every later message goes to `listener`, starting with any already queued. */
    handOver(listener: (data: Buffer) => void): void {
      tap = listener;
      queue.splice(0).forEach(listener);
    },
  };
}

export const b64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');

/** A base64 field of a message, decoded, or an error naming it. */
export function bytesOf(msg: Msg, field: string): Buffer {
  const value = msg[field];
  if (typeof value !== 'string') throw new Error(`Missing ${field}`);
  return Buffer.from(value, 'base64');
}
