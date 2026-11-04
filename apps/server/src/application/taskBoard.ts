import type { Session, Task } from '@deck/shared';
import { conflict, notFound } from '../domain/errors.js';

export interface Entry {
  task: Task;
  log: string;
  stop(): void;
  /** Called on every tick; may notify the phone. */
  tick?(now: number): Promise<void>;
}

export interface BoardDeps {
  /** True while the terminal that owns a task still exists. */
  sessionExists(id: string): boolean;
  now(): number;
  newId(): string;
}

/** The list of background tasks: adding, finding, stopping and ticking them. What each task does is up to its hooks. */
export class TaskBoard {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly deps: BoardDeps) {}

  add(
    owner: Session,
    kind: Task['kind'],
    name: string,
    hooks: Pick<Entry, 'stop' | 'tick'>,
  ): Entry {
    const task: Task = {
      id: this.deps.newId(),
      name,
      kind,
      status: 'running',
      profile: owner.provider,
      sessionId: owner.id,
      createdAt: new Date(this.deps.now()).toISOString(),
      detail: '',
    };
    const entry: Entry = { task, log: '', ...hooks };
    this.entries.set(task.id, entry);
    return entry;
  }

  update(entry: Entry, patch: Partial<Task>): void {
    entry.task = { ...entry.task, ...patch };
  }

  list(profile?: string): Task[] {
    return [...this.entries.values()]
      .map((e) => e.task)
      .filter((t) => profile === undefined || t.profile === profile);
  }

  /** The task `id`, only when it belongs to `profile` (when given): tasks never cross profiles. */
  get(id: string, profile?: string): Entry {
    const found = this.entries.get(id);
    if (!found || (profile !== undefined && found.task.profile !== profile))
      throw notFound(`Task ${id}`);
    return found;
  }

  find(match: (task: Task) => boolean): Entry | undefined {
    return [...this.entries.values()].find((e) => match(e.task));
  }

  stop(id: string, profile?: string): Task {
    const entry = this.get(id, profile);
    if (entry.task.status !== 'running') throw conflict('The task is not running');
    entry.stop();
    this.update(entry, { status: 'stopped' });
    return entry.task;
  }

  /** Takes a task off the list (stopping it first if it still runs). */
  remove(id: string): void {
    const entry = this.get(id);
    if (entry.task.status === 'running') entry.stop();
    this.entries.delete(id);
  }

  /** Ticks every running task once; ends the ones whose terminal is gone. */
  async poll(now: number): Promise<void> {
    for (const entry of [...this.entries.values()]) {
      if (entry.task.status !== 'running') continue;
      if (!this.deps.sessionExists(entry.task.sessionId)) {
        entry.stop();
        this.update(entry, { status: 'stopped', detail: 'terminal ended' });
        continue;
      }
      try {
        await entry.tick?.(now);
      } catch (error) {
        this.update(entry, { detail: error instanceof Error ? error.message : 'failed' });
      }
    }
  }
}
