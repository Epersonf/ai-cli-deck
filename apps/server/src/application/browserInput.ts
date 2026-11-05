import { DeckError, invalid } from '../domain/errors.js';
import type { BrowserInput, PageDriver } from './browserTypes.js';

/** What a person's input does to the page. */
export function applyInput(page: PageDriver, input: BrowserInput): Promise<void> {
  switch (input.kind) {
    case 'click':
      return page.clickAt(input.x, input.y);
    case 'type':
      return page.type(input.text);
    case 'key':
      return page.press(input.key);
    case 'scroll':
      return page.scroll(input.dy, input.dx ?? 0);
    case 'back':
      return page.back();
    case 'forward':
      return page.forward();
    case 'reload':
      return page.reload();
  }
}

/** Browser failures (timeouts, bad selectors, navigation errors) become short 400s, not 500s. */
export async function asBadRequest<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (e) {
    if (e instanceof DeckError) throw e;
    const text = e instanceof Error ? e.message : 'Browser error';
    throw invalid(text.split(/\r?\n/)[0] ?? 'Browser error');
  }
}
