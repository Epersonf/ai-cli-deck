import { markAuth } from '../domain/authError.js';
import type { AgentConfig, AgentSink } from '../domain/agent.js';
import type { ChatBook } from './ChatBook.js';
import type { ChatSettings } from './ChatSettings.js';
import type { UsageMeter } from './UsageMeter.js';

export interface SinkHost {
  book: ChatBook;
  settings: ChatSettings;
  meter: UsageMeter;
  remember(patch: { chatId?: string; config?: AgentConfig }): void;
  /** The agent named the model that is answering. */
  reportModel(model: string): void;
  pushUsage(): void;
  setBusy(busy: boolean): void;
  /** The turn is over: start the next queued message. */
  next(): void;
  /** An answer ended: its error, if it failed. */
  finished(error: string | null): void;
  /** The agent run is over. */
  ended(): void;
}

/** What an agent run reports: kept in the chat, announced, and used to move the turn on. */
export function chatSink(h: SinkHost): AgentSink {
  return {
    event: (raw) => {
      // A failure about credentials always carries the AUTH marker, whichever agent said it.
      const event =
        raw.t === 'turn-end' && raw.error ? { ...raw, error: markAuth(raw.error) } : raw;
      h.book.add(event);
      if (event.t === 'turn-start') h.setBusy(true);
      if (event.t !== 'turn-end') return;
      h.book.dropPartials();
      h.finished(event.error);
      h.setBusy(false);
      h.next();
    },
    delta: (id, part, text) => h.book.delta(id, part, text),
    chatId: (id) => {
      h.settings.saved(id);
      h.remember({ chatId: id });
    },
    model: (name) => h.reportModel(name),
    usage: (reading) => {
      if (h.meter.reading(reading)) h.pushUsage();
    },
    ended: () => {
      h.ended();
      h.meter.runEnded();
    },
  };
}
