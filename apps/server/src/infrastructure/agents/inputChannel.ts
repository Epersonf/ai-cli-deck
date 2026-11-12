/** An async queue the SDK reads user messages from: it stays open between turns, `close` ends the run. */
export class InputChannel<T> {
  private readonly items: T[] = [];
  private wake: (() => void) | null = null;
  private done = false;

  get closed(): boolean {
    return this.done;
  }

  push(item: T): void {
    this.items.push(item);
    this.wake?.();
  }

  close(): void {
    this.done = true;
    this.wake?.();
  }

  async *iterate(): AsyncGenerator<T> {
    for (;;) {
      while (this.items.length > 0) yield this.items.shift() as T;
      if (this.done) return;
      await new Promise<void>((resolve) => {
        this.wake = resolve;
      });
      this.wake = null;
    }
  }
}
