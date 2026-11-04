import { basename } from 'node:path';
import type { Session, Task } from '@deck/shared';
import { forbidden } from '../domain/errors.js';
import type { EventBus } from '../domain/events.js';
import type { PhonePort, PtyPort } from '../domain/ports.js';
import { batteryName, checkBattery, type BatteryRule } from './batteryRule.js';
import { IdleWatch } from './idleWatch.js';
import type { SessionManager } from './SessionManager.js';
import { stripAnsi } from './stripAnsi.js';
import { TaskBoard } from './taskBoard.js';

const LOG_CHARS = 20_000;
const POLL_MS = 15_000;
const BATTERY_CACHE_MS = 20_000;
const QUIET_MS = 30_000;

export interface TaskDeps {
  sessions: SessionManager;
  bus: EventBus;
  phone: PhonePort | null;
  pty: PtyPort;
  /** The profile's environment for a command started from this session's folder. */
  envFor(session: Session): Record<string, string>;
  /** The program and arguments that run a command line in a shell. */
  shell(commandLine: string): { command: string; args: string[] };
  now(): number;
  newId(): string;
}

const decoder = new TextDecoder();

/**
 * Background jobs of the terminals: commands that keep running, and watchers (battery level, a terminal that went
 * quiet) that notify the phone. Kept in memory: they end when the deck stops. Each belongs to a terminal's profile
 * and ends with that terminal.
 */
export class TaskService {
  readonly board: TaskBoard;
  private readonly idle = new Map<string, IdleWatch>();
  private battery: { at: number; reading: unknown } | null = null;

  constructor(private readonly deps: TaskDeps) {
    this.board = new TaskBoard({
      sessionExists: (id) => deps.sessions.get(id) !== undefined,
      now: deps.now,
      newId: deps.newId,
    });
  }

  start(): void {
    this.deps.bus.subscribe((event) => {
      for (const watch of this.idle.values()) watch.onEvent(event, this.deps.now());
    });
    setInterval(() => void this.poll(), POLL_MS).unref();
  }

  poll(now = this.deps.now()): Promise<void> {
    return this.board.poll(now);
  }

  log(id: string, profile?: string): string {
    return this.board.get(id, profile).log;
  }

  runProcess(owner: Session, commandLine: string, name?: string): Task {
    const { command, args } = this.deps.shell(commandLine);
    const handle = this.deps.pty.spawn(
      { command, args, cwd: owner.cwd, env: this.deps.envFor(owner) },
      { cols: 120, rows: 30 },
    );
    const entry = this.board.add(owner, 'process', name || commandLine.slice(0, 40), {
      stop: () => handle.kill(),
    });
    handle.onData(
      (chunk) => (entry.log = (entry.log + stripAnsi(decoder.decode(chunk))).slice(-LOG_CHARS)),
    );
    handle.onExit((code) => {
      if (entry.task.status !== 'running') return; // it was stopped: keep that
      const status = code === 0 ? 'done' : 'failed';
      this.board.update(entry, { status, detail: `exit ${code ?? '?'}` });
    });
    return entry.task;
  }

  private phone(): PhonePort {
    if (!this.deps.phone)
      throw forbidden('Phone access is off: turn it on in the Android app settings');
    return this.deps.phone;
  }

  /** One battery reading serves every watcher for a few seconds. */
  private async reading(phone: PhonePort, now: number): Promise<unknown> {
    if (!this.battery || now - this.battery.at >= BATTERY_CACHE_MS)
      this.battery = { at: now, reading: await phone.request('GET', '/battery') };
    return this.battery.reading;
  }

  watchBattery(owner: Session, rule: BatteryRule, name?: string): Task {
    const phone = this.phone();
    const entry = this.board.add(owner, 'battery', name || batteryName(rule), {
      stop: () => undefined,
      tick: async (now) => {
        const message = checkBattery(rule, await this.reading(phone, now));
        if (!message) return;
        await phone.request('POST', '/notify', { title: 'Battery', text: rule.text || message });
        this.board.update(entry, { status: 'done', detail: message });
      },
    });
    return entry.task;
  }

  /** The running "notify when quiet" watcher of a terminal, if any. */
  idleFor(sessionId: string): Task | undefined {
    return this.board.find(
      (t) => t.kind === 'idle' && t.sessionId === sessionId && t.status === 'running',
    )?.task;
  }

  /** One "tell me when this terminal goes quiet" watcher per terminal; asking again returns the same one. */
  watchIdle(owner: Session): Task {
    const phone = this.phone();
    const existing = this.idleFor(owner.id);
    if (existing) return existing;
    const label = (): string => {
      const session = this.deps.sessions.get(owner.id);
      return session?.name ?? basename(session?.cwd ?? owner.cwd);
    };
    const notify = (text: string): Promise<void> =>
      phone.request('POST', '/notify', { title: 'CLI Deck', text }).then(() => undefined);
    const watch = new IdleWatch(owner.id, QUIET_MS, notify, label);
    const entry = this.board.add(owner, 'idle', 'notify when quiet', {
      stop: () => void this.idle.delete(entry.task.id),
      tick: async (now) => {
        const note = await watch.tick(now);
        if (note) this.board.update(entry, { detail: note });
      },
    });
    this.idle.set(entry.task.id, watch);
    return entry.task;
  }

  /** Turns a terminal's watcher on or off (the terminal menu). */
  setIdle(owner: Session, on: boolean): Task | undefined {
    if (on) return this.watchIdle(owner);
    const running = this.idleFor(owner.id);
    if (running) this.board.stop(running.id);
    return undefined;
  }
}
