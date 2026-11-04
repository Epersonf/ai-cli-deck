import type { Terminal } from '@xterm/xterm';

/** Queries that make xterm send an answer back to the program. */
const CSI_QUERIES = [
  { final: 'c' }, // device attributes
  { prefix: '>', final: 'c' },
  { prefix: '=', final: 'c' },
  { final: 'n' }, // status and cursor position reports
  { prefix: '?', final: 'n' },
  { intermediates: '$', final: 'p' }, // mode reports
  { prefix: '?', intermediates: '$', final: 'p' },
  { final: 't' }, // window size reports
];
const COLOR_QUERIES = [4, 10, 11, 12];

/**
 * Under tmux, the terminal a program talks to is tmux, and tmux already answers what it asks (cursor
 * position, device attributes, colours). xterm reads the same bytes and would answer a second time, and the
 * program would take that second answer for typed text. So while `upstream()` holds, xterm keeps quiet;
 * how things look is not affected.
 */
export function quietRepliesWhen(term: Terminal, upstream: () => boolean): void {
  const quiet = (): boolean => upstream();
  for (const id of CSI_QUERIES) term.parser.registerCsiHandler(id, quiet);
  term.parser.registerDcsHandler({ intermediates: '$', final: 'q' }, quiet);
  for (const code of COLOR_QUERIES) {
    term.parser.registerOscHandler(code, (data) => upstream() && data.split(';').includes('?'));
  }
}
