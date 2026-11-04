import type { DeckEvent } from '../domain/events.js';

/** Output this soon after typing is the terminal echoing the keys, not the program answering. */
const ECHO_MS = 1500;

/**
 * Notices a terminal that went quiet after the program printed something: the usual sign that an agent finished
 * its message and waits for you. Fires once per burst of output, and only for output that is not just an echo.
 */
export class IdleWatch {
  private lastOutput = 0;
  private lastInput = 0;
  private armed = false;

  constructor(
    private readonly sessionId: string,
    private readonly quietMs: number,
    private readonly notify: (text: string) => Promise<void>,
    private readonly label: () => string,
  ) {}

  onEvent(event: DeckEvent, now: number): void {
    if (event.kind === 'input' && event.sessionId === this.sessionId) this.lastInput = now;
    if (
      event.kind === 'output' &&
      event.sessionId === this.sessionId &&
      now - this.lastInput > ECHO_MS
    ) {
      this.lastOutput = now;
      this.armed = true;
    }
  }

  /** Notifies if the terminal has been quiet long enough; returns a short note when it did, else ''. */
  async tick(now: number): Promise<string> {
    if (!this.armed || now - this.lastOutput < this.quietMs) return '';
    this.armed = false;
    await this.notify(`${this.label()} is waiting`);
    return `waited since ${new Date(this.lastOutput).toLocaleTimeString()}`;
  }
}
