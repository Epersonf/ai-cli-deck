import { TERMINAL_COLORS, TMUX_PREFIX } from '@deck/shared';
import type { LaunchSpec, MultiplexerPort, PtyHandle } from '../../domain/ports.js';
import type { Runner } from './exec.js';
import { dropLeakedEnv, neutralEnv } from './serverEnv.js';
import { TmuxControlClient } from './TmuxControlClient.js';

const SKIPPED_ENV = new Set(['TMUX', 'TMUX_PANE']);

/**
 * Dedicated tmux server so deck sessions never mix with the user's own tmux.
 * `DECK_TMUX_SOCKET` lets a second instance (e.g. a dev copy) use its own server.
 */
export const TMUX_SOCKET = process.env.DECK_TMUX_SOCKET || 'deck';
const SOCKET_ARGS = ['-u', '-L', TMUX_SOCKET];

/**
 * tmux only keeps the programs alive here. The deck talks to it in control mode and hands the program's
 * own output to the browser terminal, which draws it and keeps the scrollback: one scroll, and a local one.
 * tmux's mouse and status line are never shown. tmux still answers what a program asks its terminal (the
 * cursor position, the colours), so it is given the deck terminal's colours.
 */
const SERVER_OPTIONS = [
  ...['set-option', '-g', 'status', 'off', ';'],
  ...['set-option', '-g', 'mouse', 'off', ';'],
  // Programs that ask tmux (Claude Code does) then know focus reports reach them: the browser sends them.
  ...['set-option', '-g', 'focus-events', 'on', ';'],
  // Rebuilds the scrollback of a device that connects later.
  ...['set-option', '-g', 'history-limit', '20000', ';'],
  ...[
    'set-option',
    '-g',
    'window-style',
    `fg=${TERMINAL_COLORS.foreground},bg=${TERMINAL_COLORS.background}`,
    ';',
  ],
];

/** The session's pane, for keys and screen queries. */
const targetOf = (name: string): string => `=${name}:`;

/** The argv of a control-mode client that creates (or joins) the session `name` running `spec`. */
export function buildTmuxArgs(
  name: string,
  spec: LaunchSpec,
  size: { cols: number; rows: number },
): string[] {
  const envFlags = Object.entries(spec.env)
    .filter(([key]) => !SKIPPED_ENV.has(key))
    .flatMap(([key, value]) => ['-e', `${key}=${value}`]);
  const geometry = ['-x', String(size.cols), '-y', String(size.rows)];
  return [
    ...SOCKET_ARGS,
    '-C',
    ...SERVER_OPTIONS,
    ...['new-session', '-A', '-s', name, ...geometry, '-c', spec.cwd, ...envFlags],
    // tmux tells its programs they run inside it; here the browser terminal gets their output as written,
    // so they must not adapt to tmux (Claude Code's "tmux detected" tips, wrapped escape sequences).
    ...['env', '-u', 'TMUX', '-u', 'TMUX_PANE'],
    spec.command,
    ...spec.args,
  ];
}

export class TmuxMultiplexer implements MultiplexerPort {
  readonly available = true;

  constructor(private readonly run: Runner) {}

  launch(name: string, spec: LaunchSpec, size: { cols: number; rows: number }): PtyHandle {
    const args = buildTmuxArgs(name, spec, size);
    return new TmuxControlClient({ args, target: targetOf(name), ...place(spec), attached: false });
  }

  reattach(name: string, spec: LaunchSpec): PtyHandle {
    const args = [...SOCKET_ARGS, '-C', ...SERVER_OPTIONS, 'attach-session', '-t', `=${name}`];
    return new TmuxControlClient({ args, target: targetOf(name), ...place(spec), attached: true });
  }

  async list(): Promise<string[]> {
    try {
      const out = await this.run('tmux', [
        ...SOCKET_ARGS,
        'list-sessions',
        '-F',
        '#{session_name}',
      ]);
      return out.split('\n').filter((n) => n.startsWith(TMUX_PREFIX));
    } catch {
      return [];
    }
  }

  /** The last screen lines as text with colours, saved so a session that dies can still be read. */
  async capture(name: string): Promise<Uint8Array | null> {
    try {
      const args = [...SOCKET_ARGS, 'capture-pane', '-p', '-e', '-J', '-S', '-300', '-t'];
      const out = await this.run('tmux', [...args, targetOf(name)]);
      return Buffer.from(out.replace(/\n/g, '\r\n'), 'utf8');
    } catch {
      return null;
    }
  }

  /**
   * A tmux server started by an older deck still carries the first session's profile in its global
   * environment, and hands it to every new session. Drops whatever differs from the deck's own environment.
   */
  cleanServerEnv(): Promise<string[]> {
    return dropLeakedEnv(this.run, SOCKET_ARGS);
  }

  async kill(name: string): Promise<void> {
    await this.run('tmux', [...SOCKET_ARGS, 'kill-session', '-t', `=${name}`]).catch(
      () => undefined,
    );
  }
}

const place = (spec: LaunchSpec) => ({ env: neutralEnv(), cwd: spec.cwd });
