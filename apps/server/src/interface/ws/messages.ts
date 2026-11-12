import type { ServerMessage } from '@deck/shared';
import type { DeckEvent } from '../../domain/events.js';

/** Maps an internal event to the JSON message for one session's socket (or null to skip). */
export function eventToMessage(event: DeckEvent, sessionId: string): ServerMessage | null {
  switch (event.kind) {
    case 'session':
      return event.session.id === sessionId ? { type: 'status', session: event.session } : null;
    case 'chat':
      return event.sessionId === sessionId ? { type: 'event', event: event.event } : null;
    case 'delta':
      return event.sessionId === sessionId
        ? { type: 'delta', id: event.id, kind: event.part, text: event.text }
        : null;
    case 'busy':
      return event.sessionId === sessionId ? { type: 'busy', busy: event.busy } : null;
    case 'usage':
      return event.sessionId === sessionId ? { type: 'usage', usage: event.usage } : null;
    case 'reset':
      return event.sessionId === sessionId ? { type: 'reset', events: event.events } : null;
    case 'config':
      return event.sessionId === sessionId ? { type: 'config', config: event.config } : null;
    case 'approval':
      return event.request.sessionId === sessionId
        ? { type: 'approval-request', request: event.request }
        : null;
    case 'preview':
      return event.sessionId === sessionId ? { type: 'preview-open', url: event.url } : null;
    case 'agent-browser':
      return event.sessionId === sessionId ? { type: 'preview-browser' } : null;
    case 'new-tab':
      return event.sessionId === sessionId ? { type: 'new-tab', url: event.url } : null;
    case 'removed':
    case 'turn-done':
    case 'notify':
    case 'memory':
      return null;
  }
}
