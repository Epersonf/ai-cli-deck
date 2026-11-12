import type { Session, Task } from '@deck/shared';
import { forbidden } from '../domain/errors.js';
import type { EventBus } from '../domain/events.js';
import type { PhonePort, ProcessPort } from '../domain/ports.js';
import { batteryName, checkBattery, type BatteryRule } from './batteryRule.js';
import type { SessionManager } from './SessionManager.js';
import { stripAnsi } from './stripAnsi.js';
import { TaskBoard } from './taskBoard.js';

const LOG_CHARS = 20_000;
const POLL_MS = 15_000;
const BATTERY_CACHE_MS = 20_000;

export interface TaskDeps {
  sessions: SessionManager;
  bus: EventBus;
  phone: PhonePort | null;
  processes: ProcessPort;
  /** The profile's environment for a command started from this session's folder. */
  envFor(session: Session): Record<string, string>;
  /** The program and arguments that run a command line in a shell. */
  shell(commandLine: string): { command: string; args: string[] };
  now(): number;
  newId(): string;
}

const decoder = new TextDecoder();

/**
 * Background jobs of the terminals: commands that keep running, and watchers (battery level) that notify the phone. Kept in memory: they end when the deck stops. Each belongs to a terminal's profile
 * and ends with that terminal.
 */
export class TaskService {
  readonly board: TaskBoard;
  private battery: { at: number; reading: unknown } | null = null;

  constructor(private readonly deps: TaskDeps) {
    this.board = new TaskBoard({
      sessionExists: (id) => deps.sessions.get(id) !== undefined,
      now: deps.now,
      newId: deps.newId,
    });
  }

  start(): void {
    setInterval(() => void this.poll(), POLL_MS).unref();
  }

  poll(now = this.deps.now()): Promise<void> {
    return this.board.poll(now);
  }

  log(id: string, profile?: string): string {
    return this.board.get(id, profile).log;
  }

  runProcess(owner: Session, commandLine: string, name?: string, cwd = owner.cwd): Task {
    const { command, args } = this.deps.shell(commandLine);
    const handle = this.deps.processes.spawn({ command, args, cwd, env: this.deps.envFor(owner) });
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
}
