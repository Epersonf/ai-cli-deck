import type { EventBus } from '../domain/events.js';
import type { ChatBook } from './ChatBook.js';

/** Tells the deck when an answer ended by itself, as opposed to the person stopping it. */
export class TurnNotice {
  private stopped = false;

  constructor(
    private readonly id: string,
    private readonly bus: EventBus,
    private readonly book: ChatBook,
  ) {}

  /** A message was handed to the agent. */
  began(): void {
    this.stopped = false;
  }

  /** The person stopped the answer: its ending is not news. */
  stop(): void {
    this.stopped = true;
  }

  ended(error: string | null): void {
    if (this.stopped) return;
    this.bus.publish({
      kind: 'turn-done',
      sessionId: this.id,
      error,
      answer: this.book.lastAnswer(),
    });
  }
}
