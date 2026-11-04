import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import { attachClipboardOsc } from './clipboardOsc';
import { tameMobileKeyboard } from './mobileKeyboard';
import { openLink } from './openLink';
import { isPasteShortcut } from './pasteShortcut';
import { TERMINAL_THEME } from './theme';

/** An xterm in `element` with the deck's look, links, clipboard and paste handling. */
export function createTerminal(
  element: HTMLElement,
  sessionId: string,
): { term: Terminal; fit: FitAddon } {
  const term = new Terminal({
    fontSize: 13,
    fontFamily:
      'ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", "Noto Sans Mono", monospace',
    cursorBlink: true,
    scrollback: 3000,
    theme: TERMINAL_THEME,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.loadAddon(new WebLinksAddon((_event, uri) => openLink(sessionId, uri)));
  term.open(element);
  // Let the browser paste (text, or an image that is uploaded) instead of sending ^V to the CLI.
  term.attachCustomKeyEventHandler((event) => !isPasteShortcut(event));
  attachClipboardOsc(term);
  tameMobileKeyboard(term);
  return { term, fit };
}
