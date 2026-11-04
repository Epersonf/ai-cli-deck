import type { Reply } from './controlProtocol.js';

/** Lines of history a device gets when it connects (the browser terminal keeps as many). */
export const REPLAY_HISTORY_LINES = 10_000;

/** The pane state asked for, in the order tmux prints it. */
export const SNAPSHOT_FIELDS = [
  'cursor_x',
  'cursor_y',
  'cursor_flag',
  'alternate_on',
  'alternate_saved_x',
  'alternate_saved_y',
  'history_size',
  'pane_height',
  'keypad_cursor_flag',
  'keypad_flag',
  'mouse_standard_flag',
  'mouse_button_flag',
  'mouse_all_flag',
  'mouse_sgr_flag',
  'wrap_flag',
  'insert_flag',
  'scroll_region_upper',
  'scroll_region_lower',
] as const;
type PaneState = Record<(typeof SNAPSHOT_FIELDS)[number], number>;

/** Modes tmux keeps but has no format for, so they are followed in the program's output instead. */
export interface TrackedModes {
  bracketedPaste: boolean;
  focusEvents: boolean;
}

/**
 * Sent as one line, so tmux runs them back to back without reading the program in between: the pane's
 * state, its history, the screen in view and, under a full-screen program, the normal screen it covers.
 */
export function snapshotCommands(target: string): string[] {
  const format = SNAPSHOT_FIELDS.map((field) => `#{${field}}`).join(' ');
  const capture = `capture-pane -p -e -J -t ${target}`;
  return [
    `display-message -p -t ${target} '${format}'`,
    `${capture} -S -${REPLAY_HISTORY_LINES} -E -1`,
    `${capture} -S 0 -E -`,
    `${capture} -a -q`,
  ];
}

const CRLF = Buffer.from('\r\n');
const RESET_LINE = Buffer.from('\x1b[0m\r\n');
/** What tmux reports for a saved cursor position that was never set. */
const UNSET = 2 ** 32 - 1;
const joinLines = (lines: Buffer[]): Buffer =>
  Buffer.concat(lines.flatMap((line, i) => (i === 0 ? [line] : [CRLF, line])));

function parseState(reply: Reply | undefined): PaneState | null {
  const values = reply?.ok ? (reply.lines[0]?.toString('latin1').trim().split(' ') ?? []) : [];
  if (values.length !== SNAPSHOT_FIELDS.length) return null;
  const numbers = values.map(Number);
  if (numbers.some((n) => !Number.isInteger(n))) return null;
  return Object.fromEntries(
    SNAPSHOT_FIELDS.map((field, i) => [field, numbers[i] ?? 0]),
  ) as PaneState;
}

/** The modes, cursor and scroll region a fresh browser terminal needs to match the pane. */
function modeSequences(s: PaneState, tracked: TrackedModes): string {
  let out = '\x1b[0m';
  if (s.keypad_cursor_flag) out += '\x1b[?1h';
  if (s.keypad_flag) out += '\x1b=';
  if (s.mouse_all_flag) out += '\x1b[?1003h';
  else if (s.mouse_button_flag) out += '\x1b[?1002h';
  else if (s.mouse_standard_flag) out += '\x1b[?1000h';
  if (s.mouse_sgr_flag) out += '\x1b[?1006h';
  if (!s.wrap_flag) out += '\x1b[?7l';
  if (s.insert_flag) out += '\x1b[4h';
  if (tracked.bracketedPaste) out += '\x1b[?2004h';
  if (tracked.focusEvents) out += '\x1b[?1004h';
  if (s.scroll_region_upper !== 0 || s.scroll_region_lower !== s.pane_height - 1) {
    out += `\x1b[${s.scroll_region_upper + 1};${s.scroll_region_lower + 1}r`;
  }
  out += `\x1b[${s.cursor_y + 1};${s.cursor_x + 1}H`;
  if (!s.cursor_flag) out += '\x1b[?25l';
  return out;
}

/**
 * Bytes that make a fresh browser terminal show the pane as tmux has it: the history goes into the
 * scrollback, then the screen, the cursor and the modes. Null when tmux could not answer.
 */
export function buildReplay(replies: Reply[], tracked: TrackedModes): Uint8Array | null {
  const [info, history, screen, behind] = replies;
  const state = parseState(info);
  if (!state || !screen?.ok) return null;
  const parts: Buffer[] = [];
  // Without history tmux would hand back the first screen line instead, hence the check.
  if (state.history_size > 0 && history?.ok && history.lines.length > 0) {
    // Each capture starts from plain text, so colours left on by the last line must not run on.
    parts.push(joinLines(history.lines), RESET_LINE);
  }
  if (state.alternate_on) {
    if (behind?.ok && behind.lines.length > 0) parts.push(joinLines(behind.lines));
    const { alternate_saved_x: x, alternate_saved_y: y } = state;
    const cursor = x !== UNSET && y !== UNSET ? `\x1b[${y + 1};${x + 1}H` : '';
    parts.push(Buffer.from(`\x1b[0m${cursor}\x1b[?1049h\x1b[H`));
  }
  parts.push(joinLines(screen.lines), Buffer.from(modeSequences(state, tracked)));
  return Buffer.concat(parts);
}
