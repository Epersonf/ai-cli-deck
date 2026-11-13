import { useState, type KeyboardEvent, type RefObject } from 'react';
import { applyToken } from './suggest';
import { useSuggestions, type Suggestion } from './useSuggestions';

/** `@file` and `/command` completion for a message box: the list, the caret, and the keys that drive it. */
export function useCompletion(
  sessionId: string,
  text: string,
  setText: (text: string) => void,
  area: RefObject<HTMLTextAreaElement | null>,
  fit: () => void,
) {
  const [caret, setCaret] = useState(0);
  const suggest = useSuggestions(sessionId, text, caret);

  const pick = (item: Suggestion): void => {
    if (!suggest.token) return;
    const done = applyToken(text, suggest.token, item.insert);
    setText(done.text);
    setCaret(done.caret);
    requestAnimationFrame(() => {
      area.current?.setSelectionRange(done.caret, done.caret);
      fit();
    });
  };

  /** Arrows, Enter/Tab and Escape while the list is open; true when the key was used. */
  const onKey = (event: KeyboardEvent): boolean => {
    if (!suggest.open || event.nativeEvent.isComposing) return false;
    const chosen = suggest.items[suggest.index];
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      suggest.move(event.key === 'ArrowDown' ? 1 : -1);
    } else if ((event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey && chosen) {
      pick(chosen);
    } else if (event.key === 'Escape') {
      suggest.close();
    } else return false;
    event.preventDefault();
    return true;
  };

  return { suggest, pick, onKey, setCaret };
}
