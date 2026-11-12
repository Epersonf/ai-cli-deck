import { AUTH_MARKER } from '../domain/authError.js';
import type { EventBus } from '../domain/events.js';
import type { PhonePort } from '../domain/ports.js';

const TEXT_CHARS = 200;

export interface TurnNotifierDeps {
  bus: EventBus;
  /** Null unless the Android app enabled phone access. */
  phone: PhonePort | null;
  /** What to call a chat in the notification. */
  label(sessionId: string): string;
}

const firstLine = (text: string): string =>
  (text.split('\n').find((line) => line.trim() !== '') ?? '').trim().slice(0, TEXT_CHARS);

/**
 * Tells the person, on every device, when an agent finishes an answer, fails, or waits for a decision.
 * An answer the person stopped is not news. Devices get a `notify` push; the phone also gets a system notification.
 */
export class TurnNotifier {
  constructor(private readonly deps: TurnNotifierDeps) {}

  start(): void {
    this.deps.bus.subscribe((event) => {
      if (event.kind === 'turn-done') {
        if (event.error)
          this.tell(event.sessionId, 'error', firstLine(event.error.replace(AUTH_MARKER, '')));
        else this.tell(event.sessionId, 'done', firstLine(event.answer) || 'Finished');
      } else if (event.kind === 'approval' && event.request.kind === 'memory') {
        if (event.request.status === 'pending')
          this.tell(event.request.sessionId, 'permission', event.request.reason);
      } else if (event.kind === 'chat' && event.event.t === 'permission') {
        this.tell(event.sessionId, 'permission', `Needs approval: ${event.event.tool}`);
      }
    });
  }

  private tell(sessionId: string, reason: 'done' | 'error' | 'permission', text: string): void {
    const title = this.deps.label(sessionId);
    this.deps.bus.publish({ kind: 'notify', sessionId, title, text, reason });
    void this.deps.phone?.request('POST', '/notify', { title, text }).catch(() => undefined);
  }
}
