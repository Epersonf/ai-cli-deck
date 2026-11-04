import { describe, expect, it } from 'vitest';
import type { Reply } from './controlProtocol.js';
import { ModeTracker } from './modeTracker.js';
import { SNAPSHOT_FIELDS, buildReplay, snapshotCommands } from './screenSnapshot.js';

const reply = (...lines: string[]): Reply => ({
  ok: true,
  lines: lines.map((l) => Buffer.from(l)),
});
const FAILED: Reply = { ok: false, lines: [] };

type State = Partial<Record<(typeof SNAPSHOT_FIELDS)[number], number>>;
const BASE: State = { cursor_flag: 1, wrap_flag: 1, pane_height: 3, scroll_region_lower: 2 };
const info = (state: State): Reply =>
  reply(SNAPSHOT_FIELDS.map((field) => ({ ...BASE, ...state })[field] ?? 0).join(' '));
const text = (bytes: Uint8Array | null): string => Buffer.from(bytes ?? []).toString('utf8');
const modes = { bracketedPaste: false, focusEvents: false };

describe('screen snapshot for a device that connects', () => {
  it('asks for state, history, screen and the screen behind a full-screen program in one go', () => {
    const commands = snapshotCommands('=deck-a:');
    expect(commands).toHaveLength(4);
    expect(commands[0]).toContain("'#{cursor_x} #{cursor_y}");
    expect(commands[1]).toContain('-S -10000 -E -1');
    expect(commands[3]).toContain('-a -q');
  });

  it('puts the history in the scrollback, then the screen, the cursor and the modes', () => {
    const state = info({ history_size: 2, cursor_x: 4, cursor_y: 1, keypad_cursor_flag: 1 });
    const replies = [state, reply('old 1', '\x1b[31mold 2'), reply('$ ls', '$ ', ''), FAILED];
    const out = text(buildReplay(replies, { bracketedPaste: true, focusEvents: false }));
    // The red of the last history line is switched off before the screen starts.
    expect(out).toBe(
      'old 1\r\n\x1b[31mold 2\x1b[0m\r\n$ ls\r\n$ \r\n\x1b[0m\x1b[?1h\x1b[?2004h\x1b[2;5H',
    );
  });

  it('skips the history capture when there is none (tmux would repeat the first line)', () => {
    const replies = [info({ cursor_flag: 0 }), reply('first'), reply('first', '', ''), FAILED];
    expect(text(buildReplay(replies, modes))).toBe('first\r\n\r\n\x1b[0m\x1b[1;1H\x1b[?25l');
  });

  it('rebuilds a full-screen program over the normal screen it covers', () => {
    const state = info({ alternate_on: 1, alternate_saved_x: 2, alternate_saved_y: 0 });
    const replies = [state, FAILED, reply('vim', '~', '~'), reply('$ vim', '', '')];
    expect(text(buildReplay(replies, modes))).toBe(
      '$ vim\r\n\r\n\x1b[0m\x1b[1;3H\x1b[?1049h\x1b[Hvim\r\n~\r\n~\x1b[0m\x1b[1;1H',
    );
  });

  it('gives nothing when tmux could not answer', () => {
    expect(buildReplay([FAILED, FAILED, reply('x'), FAILED], modes)).toBeNull();
    expect(buildReplay([reply('1 2'), FAILED, reply('x'), FAILED], modes)).toBeNull();
  });
});

describe('modes tmux cannot report', () => {
  it('follows bracketed paste and focus events, even when a sequence is cut in two', () => {
    const tracker = new ModeTracker(false);
    tracker.scan(Buffer.from('prompt \x1b[?20'));
    tracker.scan(Buffer.from('04h and \x1b[?1004;25h'));
    expect(tracker).toMatchObject({ bracketedPaste: true, focusEvents: true });
    tracker.scan(Buffer.from('\x1b[?2004l'));
    expect(tracker.bracketedPaste).toBe(false);
  });

  it('assumes bracketed paste for a program that was already running', () => {
    expect(new ModeTracker(true).bracketedPaste).toBe(true);
  });
});
