import type { ChatRetry } from '@deck/shared';

/** A durable choice before scheduling; cancellation also invalidates writes already in flight. */
export class RetryTimer {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private revision = 0;
  constructor(
    private readonly save: (state: ChatRetry | null) => Promise<void>,
    private readonly resume: () => void,
    private readonly failed: () => void,
  ) {}

  async write(state: ChatRetry | null, schedule = false): Promise<boolean> {
    this.stop();
    const revision = this.revision;
    try {
      await this.save(state);
    } catch {
      if (revision === this.revision) this.failed();
      return false;
    }
    if (revision !== this.revision) return false;
    if (state && schedule) this.arm(Date.parse(state.retryAt), revision);
    return true;
  }

  private arm(at: number, revision: number): void {
    this.timer = setTimeout(
      () => {
        if (revision !== this.revision) return;
        if (Date.now() < at) this.arm(at, revision);
        else this.resume();
      },
      Math.max(1, Math.min(at - Date.now(), 86_400_000)),
    );
    this.timer.unref();
  }

  stop(): void {
    this.revision += 1;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
