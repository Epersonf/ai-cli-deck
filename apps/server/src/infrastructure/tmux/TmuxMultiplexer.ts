import { TMUX_PREFIX } from '@deck/shared';
import type { LaunchSpec, MultiplexerPort } from '../../domain/ports.js';
import type { Runner } from './exec.js';

const SKIPPED_ENV = new Set(['TMUX', 'TMUX_PANE']);

/**
 * Dedicated tmux server so deck sessions never mix with the user's own tmux.
 * `DECK_TMUX_SOCKET` lets a second instance (e.g. a dev copy) use its own server.
 */
export const TMUX_SOCKET = process.env.DECK_TMUX_SOCKET || 'deck';
const SOCKET_ARGS = ['-u', '-L', TMUX_SOCKET];

/** Builds the argv that creates-or-attaches a tmux session running `spec`. */
export function buildTmuxArgs(name: string, spec: LaunchSpec): string[] {
  const envFlags = Object.entries(spec.env)
    .filter(([key]) => !SKIPPED_ENV.has(key))
    .flatMap(([key, value]) => ['-e', `${key}=${value}`]);
  // Options come first: `new-session -A` only returns when the client detaches.
  return [
    ...SOCKET_ARGS,
    ...['set-option', '-g', 'status', 'off', ';'],
    ...['set-option', '-g', 'escape-time', '10', ';'],
    // Stay on the browser terminal's normal screen (no alternate screen switch).
    ...['set-option', '-ga', 'terminal-overrides', ',*:smcup@:rmcup@', ';'],
    // The wheel goes to tmux, which hands it to a program that asked for the mouse (e.g. an agent
    // that scrolls its own chat) or else scrolls tmux's history, which holds the whole session.
    ...['set-option', '-g', 'mouse', 'on', ';'],
    ...['set-option', '-g', 'history-limit', '20000', ';'],
    // Text selected with the mouse (tmux copy mode) is sent to the browser's clipboard via OSC 52.
    ...['set-option', '-g', 'set-clipboard', 'on', ';'],
    ...['set-option', '-ga', 'terminal-overrides', `,*:Ms=\\E]52;%p1%s;%p2%s\\007`, ';'],
    ...['new-session', '-A', '-s', name, '-c', spec.cwd, ...envFlags],
    spec.command,
    ...spec.args,
  ];
}

export class TmuxMultiplexer implements MultiplexerPort {
  readonly available = true;

  constructor(private readonly run: Runner) {}

  wrap(name: string, spec: LaunchSpec): LaunchSpec {
    return { command: 'tmux', args: buildTmuxArgs(name, spec), env: spec.env, cwd: spec.cwd };
  }

  attach(name: string, spec: LaunchSpec): LaunchSpec {
    const args = [...SOCKET_ARGS, 'attach-session', '-t', `=${name}`];
    return { command: 'tmux', args, env: spec.env, cwd: spec.cwd };
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

  async capture(name: string): Promise<Uint8Array | null> {
    try {
      const args = [
        ...SOCKET_ARGS,
        'capture-pane',
        '-p',
        '-e',
        '-J',
        '-S',
        '-300',
        '-t',
        `=${name}:`,
      ];
      const out = await this.run('tmux', args);
      return Buffer.from(out.replace(/\n/g, '\r\n'), 'utf8');
    } catch {
      return null;
    }
  }

  async kill(name: string): Promise<void> {
    await this.run('tmux', [...SOCKET_ARGS, 'kill-session', '-t', `=${name}`]).catch(
      () => undefined,
    );
  }
}
