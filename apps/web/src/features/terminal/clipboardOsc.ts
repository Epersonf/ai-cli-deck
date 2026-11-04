import type { Terminal } from '@xterm/xterm';

/**
 * The text of an OSC 52 "set clipboard" request (`<targets>;<base64>`), or null for a query/clear or bad data.
 * tmux sends one when something is copied with the mouse in its copy mode.
 */
export function osc52Text(data: string): string | null {
  const payload = data.slice(data.indexOf(';') + 1);
  if (payload === '' || payload === '?') return null;
  try {
    const bytes = Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** Puts what the program copied (OSC 52) on the browser's clipboard. Never reads it back. */
export function attachClipboardOsc(term: Terminal): void {
  term.parser.registerOscHandler(52, (data) => {
    const text = osc52Text(data);
    if (text !== null) void navigator.clipboard?.writeText(text).catch(() => undefined);
    return true;
  });
}
