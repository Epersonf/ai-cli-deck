import type { Mux } from './mux.js';

/** A WebSocket-like end: the browser's, the target's, or the far side of the tunnel. */
export interface PeerSocket {
  send(data: Buffer, binary: boolean): void;
  close(code?: number, reason?: string): void;
  onMessage(listener: (data: Buffer, binary: boolean) => void): void;
  onClose(listener: (code: number, reason: string) => void): void;
}

/** Valid close codes an application may send (others make `ws` throw). */
export const closeCode = (code: unknown): number =>
  typeof code === 'number' && (code === 1000 || (code >= 3000 && code <= 4999)) ? code : 1000;

/** Joins a local socket to stream `id` of the tunnel, both ways, until either side closes. */
export function bridge(mux: Mux, id: number, socket: PeerSocket): void {
  let open = true;
  const finish = (): boolean => {
    if (!open) return false;
    open = false;
    mux.end(id);
    return true;
  };
  mux.adopt(id, {
    frame(head, body) {
      if (head.k === 'm') socket.send(body, head.b === true);
      if (head.k === 'c' || head.k === 'x') {
        if (finish()) socket.close(closeCode(head.code), String(head.reason ?? '').slice(0, 120));
      }
    },
    drop: () => finish() && socket.close(1001, 'Link closed'),
  });
  socket.onMessage((data, binary) => {
    if (!open) return;
    if (!mux.overloaded) return mux.send({ k: 'm', s: id, b: binary }, data);
    socket.close(4408, 'too far behind'); // like a slow device on the deck itself
  });
  socket.onClose((code, reason) => {
    if (finish()) mux.send({ k: 'c', s: id, code, reason });
  });
}
