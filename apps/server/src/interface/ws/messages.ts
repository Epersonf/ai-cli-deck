import { OUTPUT_FRAME, REPLAY_FRAME, type ServerMessage } from '@deck/shared';
import type { DeckEvent } from '../../domain/events.js';

/** Maps an internal event to the JSON message for one session's socket (or null to skip). */
export function eventToMessage(event: DeckEvent, sessionId: string): ServerMessage | null {
  switch (event.kind) {
    case 'output':
    case 'input':
      return null; // output goes as a binary frame (see outputFrame); input is never echoed
    case 'session':
      return event.session.id === sessionId ? { type: 'status', session: event.session } : null;
    case 'exit':
      return event.sessionId === sessionId ? { type: 'exit', code: event.code } : null;
    case 'approval':
      return event.request.sessionId === sessionId
        ? { type: 'approval-request', request: event.request }
        : null;
    case 'preview':
      return event.sessionId === sessionId ? { type: 'preview-open', url: event.url } : null;
    case 'size':
      return event.sessionId === sessionId
        ? { type: 'size', cols: event.cols, rows: event.rows }
        : null;
    case 'new-tab':
      return event.sessionId === sessionId ? { type: 'new-tab', url: event.url } : null;
  }
}

/** Terminal bytes as one binary frame: a kind byte, then the bytes as they are. */
export function outputFrame(bytes: Uint8Array, replay = false): Buffer {
  const frame = Buffer.allocUnsafe(bytes.byteLength + 1);
  frame[0] = replay ? REPLAY_FRAME : OUTPUT_FRAME;
  frame.set(bytes, 1);
  return frame;
}
