import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { PtyHandle } from '../../domain/ports.js';
import {
  ControlParser,
  sendKeysCommands,
  type ControlEvent,
  type Reply,
} from './controlProtocol.js';
import { ModeTracker } from './modeTracker.js';
import { buildReplay, snapshotCommands } from './screenSnapshot.js';

const FAILED: Reply = { ok: false, lines: [] };
/** A pause in the output this long means the program finished drawing a frame. */
const QUIET_MS = 40;
const MAX_WAIT_MS = 400;
const ignore = (): void => undefined;

export interface ControlClientOptions {
  /** The whole tmux argv, `-C` included. */
  args: string[];
  /** Where keys and queries go, e.g. `=deck-abc:` (the session's pane). */
  target: string;
  env: Record<string, string>;
  cwd: string;
  /** True when the program was already running (the deck restarted): its modes are not known. */
  attached: boolean;
}

/**
 * A deck session seen through a tmux control-mode client. The browser gets the program's own bytes, so the
 * browser terminal is the one terminal the program draws on (scrollback included) while tmux only keeps the
 * program alive; keys go in with send-keys; a device that connects later gets a snapshot of the screen.
 */
export class TmuxControlClient implements PtyHandle {
  private readonly proc: ChildProcessWithoutNullStreams;
  private readonly modes: ModeTracker;
  private readonly dataListeners: Array<(data: Uint8Array) => void> = [];
  private readonly exitListeners: Array<(code: number | null) => void> = [];
  /** One entry per command sent; tmux answers them in order. */
  private readonly waiting: Array<(reply: Reply) => void> = [];
  /** Output parsed from the current chunk, handed on in one piece (and always before a reply). */
  private pending: Uint8Array[] = [];
  /** When the program last wrote something. */
  private outputAt = 0;
  private exitCode: number | null | undefined;

  constructor(private readonly options: ControlClientOptions) {
    this.modes = new ModeTracker(options.attached);
    this.proc = spawn('tmux', options.args, { env: options.env, cwd: options.cwd, stdio: 'pipe' });
    const parser = new ControlParser((event) => this.handle(event));
    this.proc.stdout.on('data', (chunk: Buffer) => {
      parser.push(chunk);
      this.flush();
    });
    this.proc.stdin.on('error', ignore); // tmux went away: 'close' reports it
    this.proc.stderr.resume();
    this.proc.on('error', () => this.finish(null));
    this.proc.on('close', (code) => this.finish(code));
  }

  write(data: string): void {
    for (const command of sendKeysCommands(this.options.target, data))
      this.send([command], [ignore]);
  }

  resize(cols: number, rows: number): void {
    this.send([`refresh-client -C ${cols},${rows}`], [ignore]);
  }

  onData(listener: (data: Uint8Array) => void): void {
    this.dataListeners.push(listener);
  }

  onExit(listener: (code: number | null) => void): void {
    this.exitListeners.push(listener);
  }

  /** Detaches from tmux; the program keeps running. */
  kill(): void {
    this.proc.stdin.end();
    setTimeout(() => this.proc.kill(), 1000).unref();
  }

  /**
   * The screen, cursor and modes, handed over at an exact point of the output: everything given to `onData`
   * before `done` runs is part of it, everything after is not. Null when tmux could not answer.
   */
  snapshot(done: (screen: Uint8Array | null) => void): void {
    const commands = snapshotCommands(this.options.target);
    const replies: Reply[] = [];
    const collect = (reply: Reply): void => {
      replies.push(reply);
      if (replies.length === commands.length) done(buildReplay(replies, this.modes));
    };
    // Taken between two frames when possible: halfway through one, the program may rely on state a
    // snapshot cannot carry (a saved cursor, the colour it set). A program that never pauses waits no more.
    const asked = Date.now();
    const take = (): void => {
      const quiet = Date.now() - this.outputAt;
      if (quiet >= QUIET_MS || Date.now() - asked >= MAX_WAIT_MS) {
        this.send(
          commands,
          commands.map(() => collect),
        );
      } else setTimeout(take, QUIET_MS - quiet);
    };
    take();
  }

  private send(commands: string[], answers: Array<(reply: Reply) => void>): void {
    if (this.exitCode !== undefined || !this.proc.stdin.writable) {
      for (const answer of answers) answer(FAILED);
      return;
    }
    this.waiting.push(...answers);
    this.proc.stdin.write(`${commands.join(' ; ')}\n`);
  }

  private handle(event: ControlEvent): void {
    if (event.kind === 'output') {
      this.modes.scan(event.data);
      this.pending.push(event.data);
      this.outputAt = Date.now();
      return;
    }
    this.flush();
    if (event.kind === 'reply') this.waiting.shift()?.(event.reply);
  }

  private flush(): void {
    if (this.pending.length === 0) return;
    const data = this.pending.length === 1 ? this.pending[0] : Buffer.concat(this.pending);
    this.pending = [];
    if (data) for (const listener of this.dataListeners) listener(data);
  }

  private finish(code: number | null): void {
    if (this.exitCode !== undefined) return;
    this.exitCode = code;
    this.flush();
    for (const answer of this.waiting.splice(0)) answer(FAILED);
    for (const listener of this.exitListeners) listener(code);
  }
}
