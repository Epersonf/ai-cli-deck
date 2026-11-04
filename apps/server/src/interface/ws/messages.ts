import type { DeckEvent } from '../../domain/events.js';
import type { ServerMessage } from '@deck/shared';

/** Maps an internal event to the wire message for one session's socket (or null to skip). */
export function eventToMessage(event: DeckEvent, sessionId: string): ServerMessage | null {
  switch (event.kind) {
    case 'output':
      return event.sessionId === sessionId
        ? { type: 'output', data: Buffer.from(event.data).toString('base64'), replay: false }
        : null;
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
    case 'input':
      return null;
    case 'size':
      return event.sessionId === sessionId
        ? { type: 'size', cols: event.cols, rows: event.rows }
        : null;
    case 'new-tab':
      return event.sessionId === sessionId ? { type: 'new-tab', url: event.url } : null;
  }
}

export const replayMessage = (bytes: Uint8Array): ServerMessage => ({
  type: 'output',
  data: Buffer.from(bytes).toString('base64'),
  replay: true,
});
