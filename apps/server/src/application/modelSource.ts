import type { ModelBook } from './ModelBook.js';
import type { ModelCatalog } from './ModelCatalog.js';
import type { ModelSource } from './ChatSettings.js';

/** What a chat of one provider knows about models: the discovered list, the default, the last that answered. */
export function modelSource(
  providerId: string,
  book: ModelBook,
  catalog: ModelCatalog,
): ModelSource {
  return {
    choices: () => catalog.choices(providerId),
    refresh: () => void catalog.refresh(providerId),
    defaultModel: () => book.defaultOf(providerId),
    lastKnown: () => book.effectiveOf(providerId) ?? catalog.current(providerId),
    keepMode: (mode) => book.setMode(providerId, mode),
    remember: (model) => book.setEffective(providerId, model),
  };
}
