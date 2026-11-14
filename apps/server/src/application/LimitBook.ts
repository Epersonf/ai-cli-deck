import type { UsageReading } from '../domain/agent.js';

export type Limit = NonNullable<UsageReading['limit']>;

/** Keeps the limits between server runs. */
export interface LimitStore {
  load(): Promise<Record<string, unknown>>;
  save(all: Record<string, Limit[]>): Promise<void>;
}

/** Older files kept one unnamed window per account. */
function asLimits(saved: unknown): Limit[] {
  const list = Array.isArray(saved) ? saved : [saved];
  return list.flatMap((item): Limit[] => {
    if (typeof item !== 'object' || item === null) return [];
    const o = item as Record<string, unknown>;
    if (typeof o['used'] !== 'number') return [];
    const label = typeof o['label'] === 'string' ? o['label'] : null;
    const key = typeof o['key'] === 'string' ? o['key'] : (label ?? 'limit');
    const resetsAt = typeof o['resetsAt'] === 'string' ? o['resetsAt'] : null;
    return [{ key, used: o['used'], resetsAt, label }];
  });
}

/** The usage windows each account (profile) last reported: shared by all that profile's sessions. */
export class LimitBook {
  private readonly all = new Map<string, Map<string, Limit>>();
  private readonly listeners = new Set<(key: string) => void>();

  constructor(
    private readonly store: LimitStore | null = null,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async restore(): Promise<void> {
    const saved = (await this.store?.load().catch(() => null)) ?? {};
    for (const [account, value] of Object.entries(saved))
      this.all.set(account, new Map(asLimits(value).map((l) => [l.key, l])));
  }

  /** The windows as last seen, leaving out the ones that have reset (their figure is out of date). */
  get(account: string): Limit[] {
    const now = this.now().getTime();
    return [...(this.all.get(account)?.values() ?? [])].filter(
      (l) => !l.resetsAt || Date.parse(l.resetsAt) > now || Number.isNaN(Date.parse(l.resetsAt)),
    );
  }

  set(account: string, limit: Limit): void {
    const windows = this.all.get(account) ?? new Map<string, Limit>();
    windows.set(limit.key, limit);
    this.all.set(account, windows);
    const everything = Object.fromEntries([...this.all].map(([k, w]) => [k, [...w.values()]]));
    void this.store?.save(everything).catch(() => undefined);
    for (const listener of this.listeners) listener(account);
  }

  onChange(listener: (key: string) => void): void {
    this.listeners.add(listener);
  }
}
