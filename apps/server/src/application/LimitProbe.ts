import type { ProviderRegistry } from '../domain/provider.js';
import type { LimitBook } from './LimitBook.js';

/** Asking again sooner than this gives the same answer (and starts Claude Code for nothing). */
const FRESH_MS = 60_000;

/**
 * Asks a provider for its account's usage windows without a chat having to answer first, and puts what
 * it says in the limit book. One question at a time per provider; never fails (the book keeps what it had).
 */
export class LimitProbe {
  private readonly last = new Map<string, number>();
  private readonly running = new Map<string, Promise<void>>();

  constructor(
    private readonly providers: ProviderRegistry,
    private readonly limits: LimitBook,
    private readonly now: () => number = Date.now,
  ) {}

  refresh(providerId: string): Promise<void> {
    const running = this.running.get(providerId);
    if (running) return running;
    const asked = this.last.get(providerId);
    if (asked !== undefined && this.now() - asked < FRESH_MS) return Promise.resolve();
    const provider = this.providers.get(providerId);
    if (!provider?.discoverLimits) return Promise.resolve();
    this.last.set(providerId, this.now());
    const task = provider
      .discoverLimits()
      .then((found) => found.forEach((limit) => this.limits.set(providerId, limit)))
      .catch(() => undefined)
      .finally(() => this.running.delete(providerId));
    this.running.set(providerId, task);
    return task;
  }
}
