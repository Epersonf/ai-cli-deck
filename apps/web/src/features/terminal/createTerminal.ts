import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebglAddon } from '@xterm/addon-webgl';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import { attachClipboardOsc } from './clipboardOsc';
import { tameMobileKeyboard } from './mobileKeyboard';
import { openLink } from './openLink';
import { isPasteShortcut } from './pasteShortcut';
import { TERMINAL_THEME } from './theme';
import { quietRepliesWhen } from './upstreamReplies';

export const FONT_SIZE = 13;
/** Lines kept above the screen. This is the only scrollback: tmux's own is never shown. */
const SCROLLBACK = 10_000;

/**
 * An xterm in `element` with the deck's look, links, clipboard and paste handling. `upstream()` says whether
 * tmux sits in between and answers the program's queries itself.
 */
export function createTerminal(
  element: HTMLElement,
  sessionId: string,
  upstream: () => boolean,
): { term: Terminal; fit: FitAddon } {
  const term = new Terminal({
    fontSize: FONT_SIZE,
    fontFamily:
      'ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", "Noto Sans Mono", monospace',
    cursorBlink: true,
    scrollback: SCROLLBACK,
    theme: TERMINAL_THEME,
    // Needed by the Unicode 11 widths below.
    allowProposedApi: true,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.loadAddon(new WebLinksAddon((_event, uri) => openLink(sessionId, uri)));
  // Emoji and other wide characters take two cells, as the CLIs and tmux count them.
  term.loadAddon(new Unicode11Addon());
  term.unicode.activeVersion = '11';
  term.open(element);
  useGpu(term);
  quietRepliesWhen(term, upstream);
  // Let the browser paste (text, or an image that is uploaded) instead of sending ^V to the CLI.
  term.attachCustomKeyEventHandler((event) => !isPasteShortcut(event));
  attachClipboardOsc(term);
  tameMobileKeyboard(term);
  return { term, fit };
}

/** The GPU renderer keeps big redraws smooth; xterm's DOM renderer takes over without WebGL or if it is lost. */
function useGpu(term: Terminal): void {
  try {
    const webgl = new WebglAddon();
    webgl.onContextLoss(() => webgl.dispose());
    term.loadAddon(webgl);
  } catch {
    // No WebGL here: the DOM renderer stays.
  }
}
