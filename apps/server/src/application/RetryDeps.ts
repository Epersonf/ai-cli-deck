import type { ChatRetry, ChatUsage } from '@deck/shared';
import type { ChatBook } from './ChatBook.js';
import type { ChatSettings } from './ChatSettings.js';
import type { TurnRunner } from './TurnRunner.js';

export interface RetryPersistence {
  initial: ChatRetry | null;
  save(state: ChatRetry | null): Promise<void>;
}
export interface RetryDeps {
  book: ChatBook;
  settings: ChatSettings;
  runner: TurnRunner;
  persistence: RetryPersistence;
  uuid(): string;
  usage(): ChatUsage;
  changed(): void;
  hold(): void;
  release(): void;
}
