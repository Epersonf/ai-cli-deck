import type { TrackedModes } from './screenSnapshot.js';

// eslint-disable-next-line no-control-regex -- DEC private mode set/reset: ESC [ ? <modes> h|l
const PRIVATE_MODE = /\x1b\[\?([\d;]*)([hl])/g;
/** Enough of the previous chunk to catch a sequence cut in two. */
const TAIL = 16;

/**
 * Follows, in the program's output, the modes tmux keeps but cannot report: bracketed paste (pasted text
 * arrives as one block instead of being typed line by line) and focus events.
 */
export class ModeTracker implements TrackedModes {
  bracketedPaste: boolean;
  focusEvents = false;
  private tail = '';

  /**
   * `attached`: the program was already running before we listened (the deck restarted), so its modes are
   * unknown. Shells and agent CLIs all turn bracketed paste on, so that is the safer guess.
   */
  constructor(attached: boolean) {
    this.bracketedPaste = attached;
  }

  scan(data: Uint8Array): void {
    const text =
      this.tail + Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('latin1');
    for (const match of text.matchAll(PRIVATE_MODE)) {
      const on = match[2] === 'h';
      for (const mode of (match[1] ?? '').split(';')) {
        if (mode === '2004') this.bracketedPaste = on;
        if (mode === '1004') this.focusEvents = on;
      }
    }
    this.tail = text.slice(-TAIL);
  }
}
