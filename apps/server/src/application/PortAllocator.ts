import { DeckError } from '../domain/errors.js';

export interface PortRange {
  min: number;
  max: number;
}

/** Hands out one free port per session from a configured range. */
export class PortAllocator {
  private readonly taken = new Set<number>();

  constructor(
    private readonly range: PortRange,
    private readonly isFree: (port: number) => Promise<boolean>,
  ) {}

  reserve(port: number): void {
    this.taken.add(port);
  }

  release(port: number): void {
    this.taken.delete(port);
  }

  async allocate(): Promise<number> {
    for (let port = this.range.min; port <= this.range.max; port += 1) {
      if (this.taken.has(port)) continue;
      if (await this.isFree(port)) {
        this.taken.add(port);
        return port;
      }
    }
    throw new DeckError('unavailable', 'No free preview port left in the configured range');
  }
}
