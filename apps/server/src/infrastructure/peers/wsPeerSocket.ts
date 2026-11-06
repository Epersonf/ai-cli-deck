import type { WebSocket } from 'ws';
import type { PeerSocket } from './peerSocket.js';

/** A `ws` socket as a PeerSocket; messages that arrive before anyone listens are kept, not lost. */
export function wsPeerSocket(ws: WebSocket): PeerSocket {
  const early: [Buffer, boolean][] = [];
  let listener: ((data: Buffer, binary: boolean) => void) | null = null;
  ws.on('message', (data, binary) => {
    const bytes = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer);
    if (listener) listener(bytes, binary);
    else early.push([bytes, binary]);
  });
  return {
    send: (data, binary) => {
      if (ws.readyState === ws.OPEN) ws.send(data, { binary });
    },
    close: (code, reason) => ws.close(code, reason),
    onMessage(next) {
      listener = next;
      early.splice(0).forEach(([data, binary]) => next(data, binary));
    },
    onClose: (next) => ws.on('close', (code, reason) => next(code, reason.toString())),
  };
}
