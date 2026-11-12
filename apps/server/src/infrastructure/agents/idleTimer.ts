/** Runs `onIdle` after `ms` of quiet; while `holdOn()` is true it waits another round instead. */
export class IdleTimer {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly ms: number,
    private readonly holdOn: () => boolean,
    private readonly onIdle: () => void,
  ) {}

  start(): void {
    this.clear();
    this.timer = setTimeout(() => (this.holdOn() ? this.start() : this.onIdle()), this.ms);
    this.timer.unref();
  }

  clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
