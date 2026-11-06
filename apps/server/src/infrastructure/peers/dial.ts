import { WebSocket } from 'ws';
import { wsWire, type Wire } from './wire.js';

const DIAL_MS = 4_000;
const MAX_FRAME = 16 << 20;

/** Opens a WebSocket to another deck's peer port (`/pair` or `/link`). */
export function dial(address: string, path: '/pair' | '/link'): Promise<Wire> {
  const ws = new WebSocket(`ws://${address}${path}`, {
    handshakeTimeout: DIAL_MS,
    maxPayload: MAX_FRAME,
  });
  const wire = wsWire(ws); // listening already: the first answer is never missed
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve(wire));
    ws.once('error', (error) => reject(new Error(`Cannot reach ${address}: ${error.message}`)));
  });
}
