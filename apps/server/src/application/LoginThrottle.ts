interface Window {
  count: number;
  startedAt: number;
}

/** Limits password guesses per client: `max` failures per `windowMs`, then locked until it ends. */
export class LoginThrottle {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly now: () => number,
    private readonly max = 5,
    private readonly windowMs = 60_000,
  ) {}

  /** Seconds the client must wait, or 0 when it may try. */
  check(key: string): number {
    this.prune();
    const window = this.windows.get(key);
    if (!window || window.count < this.max) return 0;
    return Math.ceil((window.startedAt + this.windowMs - this.now()) / 1000);
  }

  fail(key: string): void {
    const current = this.windows.get(key);
    const fresh = !current || this.now() - current.startedAt >= this.windowMs;
    this.windows.set(
      key,
      fresh ? { count: 1, startedAt: this.now() } : { ...current, count: current.count + 1 },
    );
  }

  succeed(key: string): void {
    this.windows.delete(key);
  }

  private prune(): void {
    for (const [key, window] of this.windows) {
      if (this.now() - window.startedAt >= this.windowMs) this.windows.delete(key);
    }
  }
}
