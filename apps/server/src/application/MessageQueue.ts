import type { ImageInput } from '@deck/shared';
import type { EventBus } from '../domain/events.js';

interface Queued {
  id: string;
  text: string;
  images: readonly ImageInput[];
}

/** Messages typed while an answer is being written; every change is published so each device shows the same list. */
export class MessageQueue {
  private items: Queued[] = [];

  constructor(
    private readonly sessionId: string,
    private readonly bus: EventBus,
    private readonly uuid: () => string,
    private readonly chat: {
      readonly isBusy: boolean;
      send(text: string, images: readonly ImageInput[]): Promise<void>;
      interrupt(): void;
    },
  ) {}

  view(): { id: string; text: string; images: number }[] {
    return this.items.map((q) => ({ id: q.id, text: q.text, images: q.images.length }));
  }

  /** Sends the message, or holds it here while an answer is being written. */
  async sendOrQueue(text: string, images: readonly ImageInput[]): Promise<void> {
    if (!this.chat.isBusy) return this.chat.send(text, images);
    this.items.push({ id: this.uuid(), text, images });
    this.publish();
  }

  /** Sends one message at once: it goes first, and the answer being written is stopped to make room. */
  async now(id: string): Promise<void> {
    if (!this.promote(id)) return;
    if (this.chat.isBusy) this.chat.interrupt();
    else await this.flush();
  }

  /** The answer ended: what waited goes out, in the order it was typed. */
  async flush(): Promise<void> {
    for (const item of this.drain()) await this.chat.send(item.text, item.images);
  }

  /** Moves one message to the front (to go first); false when it is not there. */
  private promote(id: string): boolean {
    const at = this.items.findIndex((q) => q.id === id);
    const [item] = at < 0 ? [] : this.items.splice(at, 1);
    if (!item) return false;
    this.items.unshift(item);
    this.publish();
    return true;
  }

  drop(id: string): void {
    const before = this.items.length;
    this.items = this.items.filter((q) => q.id !== id);
    if (this.items.length !== before) this.publish();
  }

  /** Takes everything, in the order it was typed. */
  drain(): Queued[] {
    const taken = this.items.splice(0);
    if (taken.length > 0) this.publish();
    return taken;
  }

  private publish(): void {
    this.bus.publish({ kind: 'queue', sessionId: this.sessionId, items: this.view() });
  }
}
