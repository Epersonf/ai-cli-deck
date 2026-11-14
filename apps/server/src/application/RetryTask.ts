import type { ChatRetry, ImageInput } from '@deck/shared';
import type { ChatBook } from './ChatBook.js';
import type { ChatSettings } from './ChatSettings.js';
import type { TurnRunner } from './TurnRunner.js';

const CONTINUE =
  'Continue the interrupted task from the current conversation state. Check what already completed and do not repeat completed actions.';

/** Resume the saved thread; resend the original input only if no thread was ever established. */
export class RetryTask {
  private source: { id: string; prompt: string; images: readonly ImageInput[] } | null = null;
  constructor(
    private readonly runner: TurnRunner,
    private readonly book: ChatBook,
    private readonly settings: ChatSettings,
    private readonly uuid: () => string,
  ) {}

  capture(): string | null {
    this.source ??= this.runner.current;
    return this.source?.id ?? null;
  }

  restore(state: ChatRetry): boolean {
    const pendingFork = this.settings.run().fork;
    if (state.threadId !== (pendingFork ? null : this.settings.chatId)) return false;
    const events = this.book.all();
    const at = events.findIndex((e) => e.t === 'user' && e.id === state.sourceId);
    if (at >= 0 && events.slice(at + 1).some((e) => e.t === 'user')) return false;
    const event = events[at];
    if (
      !state.threadId &&
      (event?.t !== 'user' ||
        event.attachments.length > 0 ||
        (!pendingFork && this.book.all().some((e) => e.t === 'user' && e.id !== state.sourceId)))
    )
      return false;
    this.source = { id: state.sourceId, prompt: event?.t === 'user' ? event.text : '', images: [] };
    return true;
  }

  resume(): boolean {
    if (!this.source) return false;
    const events = this.book.all();
    const at = events.findIndex((e) => e.t === 'user' && e.id === this.source?.id);
    const worked =
      at < 0 ||
      events
        .slice(at + 1)
        .some(
          (e) => e.t === 'text' || e.t === 'thinking' || e.t === 'tool' || e.t === 'permission',
        );
    const continuing = this.settings.chatId && !this.settings.run().fork && worked;
    this.runner.resume(
      this.uuid(),
      continuing ? CONTINUE : this.source.prompt,
      continuing ? [] : this.source.images,
    );
    return true;
  }

  clear(): void {
    this.source = null;
  }
}
