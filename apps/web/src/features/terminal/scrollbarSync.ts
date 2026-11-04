import type { Terminal } from '@xterm/xterm';

interface WithViewport {
  _core?: { _viewport?: { queueSync?(): void } };
}

/**
 * xterm 6 sizes its scrollbar from the screen's height but does not size it again when only that height
 * changes: a terminal resized while hidden (another session was on screen) or given a new font kept a
 * scrollbar for the old height, which then scrolled to the wrong place. This asks xterm to size it again
 * (an internal call; if a later xterm drops it, nothing happens).
 */
export function resyncScrollbar(term: Terminal): void {
  (term as unknown as WithViewport)._core?._viewport?.queueSync?.();
}

/** Resyncs each time the terminal comes into view, once xterm has applied what it put off while hidden. */
export function resyncWhenShown(term: Terminal, element: HTMLElement): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => undefined;
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) resyncScrollbar(term);
  });
  observer.observe(element);
  return () => observer.disconnect();
}
