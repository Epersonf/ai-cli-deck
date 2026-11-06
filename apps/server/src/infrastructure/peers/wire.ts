import type { WebSocket } from 'ws';

/** A message pipe between two decks: a WebSocket, or a pair of in-memory ends in tests. */
export interface Wire {
  send(data: string | Uint8Array): void;
  close(code?: number, reason?: string): void;
  onMessage(listener: (data: Buffer, text: boolean) => void): void;
  onClose(listener: (code: number) => void): void;
  /** Bytes queued and not yet sent: senders slow down above a limit. */
  buffered(): number;
}

export function wsWire(ws: WebSocket): Wire {
  return {
    send: (data) => ws.send(data),
    close: (code, reason) => ws.close(code, reason),
    onMessage: (listener) =>
      ws.on('message', (data, binary) => {
        const bytes = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer);
        listener(bytes, !binary);
      }),
    onClose: (listener) => ws.on('close', (code) => listener(code)),
    buffered: () => ws.bufferedAmount,
  };
}

/** Two connected in-memory ends (tests). */
export function memoryWires(): [Wire, Wire] {
  type End = { message: ((d: Buffer, t: boolean) => void)[]; close: ((c: number) => void)[] };
  const ends: [End, End] = [
    { message: [], close: [] },
    { message: [], close: [] },
  ];
  let closed = false;
  const make = (self: End, other: End): Wire => ({
    send: (data) => {
      if (closed) return;
      const text = typeof data === 'string';
      const bytes = Buffer.from(data);
      queueMicrotask(() => other.message.forEach((l) => l(bytes, text)));
    },
    close: (code = 1000) => {
      if (closed) return;
      closed = true;
      queueMicrotask(() => [...self.close, ...other.close].forEach((l) => l(code)));
    },
    onMessage: (listener) => void self.message.push(listener),
    onClose: (listener) => void self.close.push(listener),
    buffered: () => 0,
  });
  return [make(ends[0], ends[1]), make(ends[1], ends[0])];
}
