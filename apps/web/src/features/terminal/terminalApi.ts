import type { SearchAddon } from '@xterm/addon-search';
import type { Terminal } from '@xterm/xterm';
import { bufferText, type TextScope } from './bufferText';

/** What the bars around a terminal (extra keys, search) may do with it. */
export interface TerminalApi {
  send(data: string): void;
  applicationCursor(): boolean;
  search: SearchAddon;
  /** The terminal as plain text: the screen, or the screen with its whole scrollback. */
  text(scope: TextScope): string;
}

export function terminalApi(
  term: Terminal,
  search: SearchAddon,
  send: (data: string) => void,
): TerminalApi {
  return {
    send,
    applicationCursor: () => term.modes.applicationCursorKeysMode,
    search,
    text: (scope) => bufferText(term, scope),
  };
}
