import type { SearchAddon } from '@xterm/addon-search';
import type { Terminal } from '@xterm/xterm';

/** What the bars around a terminal (extra keys, quick prompts, search) may do with it. */
export interface TerminalApi {
  send(data: string): void;
  /** Types text as a paste: bracketed when the program asked for it, so a multi-line text stays one message. */
  paste(text: string): void;
  applicationCursor(): boolean;
  search: SearchAddon;
}

export function terminalApi(
  term: Terminal,
  search: SearchAddon,
  send: (data: string) => void,
): TerminalApi {
  return {
    send,
    paste: (text) => term.paste(text),
    applicationCursor: () => term.modes.applicationCursorKeysMode,
    search,
  };
}
