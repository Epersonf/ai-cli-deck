import type { UsageReading } from '../domain/agent.js';

export type Limit = NonNullable<UsageReading['limit']>;

/** Keeps the limits between server runs. */
export interface LimitStore {
  load(): Promise<Record<string, Limit>>;
  save(all: Record<string, Limit>): Promise<void>;
}

/** The last usage window each account (profile) reported: shared by all that profile's sessions. */
export class LimitBook {
  private readonly all = new Map<string, Limit>();
  private readonly listeners = new Set<(key: string) => void>();

  constructor(
    private readonly store: LimitStore | null = null,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async restore(): Promise<void> {
    const saved: Record<string, Limit> = (await this.store?.load().catch(() => null)) ?? {};
    for (const [key, limit] of Object.entries(saved)) this.all.set(key, limit);
  }

  /** The window as last seen; null once it has reset (the figure is then out of date). */
  get(key: string): Limit | null {
    const limit = this.all.get(key);
    if (!limit) return null;
    const resets = limit.resetsAt ? Date.parse(limit.resetsAt) : Number.NaN;
    return resets <= this.now().getTime() ? null : limit;
  }

  set(key: string, limit: Limit): void {
    this.all.set(key, limit);
    void this.store?.save(Object.fromEntries(this.all)).catch(() => undefined);
    for (const listener of this.listeners) listener(key);
  }

  onChange(listener: (key: string) => void): void {
    this.listeners.add(listener);
  }
}
