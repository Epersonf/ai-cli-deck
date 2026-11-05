import type { SearchAddon } from '@xterm/addon-search';
import type { Terminal } from '@xterm/xterm';

/** What the bars around a terminal (extra keys, search) may do with it. */
export interface TerminalApi {
  send(data: string): void;
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
    applicationCursor: () => term.modes.applicationCursorKeysMode,
    search,
  };
}
