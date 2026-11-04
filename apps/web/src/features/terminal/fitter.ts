import type { FitAddon } from '@xterm/addon-fit';
import type { Terminal } from '@xterm/xterm';
import { resyncScrollbar } from './scrollbarSync';
import type { Fitter } from './sizeSync';

/** A mirror is an overview (tap it to take over and read): it may shrink this far to show everything. */
const MIN_FONT = 3;
/** A host smaller than this is hidden or not laid out yet, and its size means nothing. */
const MIN_HOST_PX = 40;

/**
 * True when `host` has a real size on screen. Before that, xterm would measure a 2×1 terminal, and the
 * program, resized to it, would redraw itself into garbage.
 */
export const laidOut = (host: HTMLElement): boolean =>
  host.clientWidth >= MIN_HOST_PX && host.clientHeight >= MIN_HOST_PX;

/**
 * Sets the font (at most `base`) at which the terminal, keeping its rows and columns, fits in `host`: a
 * device showing another device's size then sees the whole screen, with no scrollbar of its own.
 */
export function fitFontTo(term: Terminal, host: HTMLElement, base: number): void {
  const screen = term.element?.querySelector('.xterm-screen');
  if (!(screen instanceof HTMLElement) || !laidOut(host)) return;
  // A few rounds, because cells do not grow exactly in step with the font.
  for (let round = 0; round < 3; round += 1) {
    const size = term.options.fontSize ?? base;
    const width = screen.offsetWidth || 1;
    const height = screen.offsetHeight || 1;
    const scale = Math.min(host.clientWidth / width, host.clientHeight / height);
    const next = Math.max(MIN_FONT, Math.min(base, Math.floor(size * scale * 4) / 4));
    if (next === size) break;
    term.options.fontSize = next;
  }
  resyncScrollbar(term);
}

/** How a terminal in `host` fits itself: to the window (as the owner), or into it (as a mirror). */
export function createFitter(
  term: Terminal,
  fit: FitAddon,
  host: HTMLElement,
  base: number,
): Fitter {
  return {
    fit() {
      if (!laidOut(host)) return;
      if (term.options.fontSize !== base) {
        term.options.fontSize = base;
        resyncScrollbar(term);
      }
      fit.fit();
    },
    mirror() {
      fitFontTo(term, host, base);
    },
    propose() {
      return laidOut(host) && term.options.fontSize === base ? fit.proposeDimensions() : undefined;
    },
  };
}
