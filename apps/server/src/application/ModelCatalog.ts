import type { ModelChoice } from '@deck/shared';
import type { ModelListing, ProviderRegistry } from '../domain/provider.js';

const FRESH_MS = 10 * 60_000;
const RETRY_MS = 60_000;

interface Entry {
  listing: ModelListing;
  at: number;
  ok: boolean;
}

/**
 * The models each provider offers, asked of the agent or endpoint itself and remembered for a while.
 * Asking can take seconds (Claude Code starts), so readers get what is known now and are told when it changes.
 */
export class ModelCatalog {
  private readonly entries = new Map<string, Entry>();
  private readonly loading = new Map<string, Promise<void>>();
  private readonly listeners = new Set<(providerId: string) => void>();

  constructor(
    private readonly providers: ProviderRegistry,
    private readonly now: () => number = Date.now,
  ) {}

  /** What is known right now (empty until the first answer). */
  choices(providerId: string): ModelChoice[] {
    return this.entries.get(providerId)?.listing.choices ?? [];
  }

  /** The model the agent would use unprompted, if it said. */
  current(providerId: string): string | null {
    return this.entries.get(providerId)?.listing.current ?? null;
  }

  /** Asks again when what is known is old; one question at a time per provider. Never fails. */
  refresh(providerId: string): Promise<void> {
    const entry = this.entries.get(providerId);
    if (entry && this.now() - entry.at < (entry.ok ? FRESH_MS : RETRY_MS)) return Promise.resolve();
    const running = this.loading.get(providerId);
    if (running) return running;
    const task = this.ask(providerId).finally(() => this.loading.delete(providerId));
    this.loading.set(providerId, task);
    return task;
  }

  /** Forgets the answer so the next `refresh` asks again (a key was saved, a sign-in finished). */
  invalidate(providerId: string): void {
    this.entries.delete(providerId);
  }

  onChange(listener: (providerId: string) => void): void {
    this.listeners.add(listener);
  }

  private async ask(providerId: string): Promise<void> {
    const provider = this.providers.get(providerId);
    if (!provider?.discoverModels) return;
    const before = this.entries.get(providerId);
    let entry: Entry;
    try {
      entry = { listing: await provider.discoverModels(), at: this.now(), ok: true };
    } catch {
      entry = {
        listing: before?.listing ?? { choices: [], current: null },
        at: this.now(),
        ok: false,
      };
    }
    this.entries.set(providerId, entry);
    if (JSON.stringify(before?.listing) !== JSON.stringify(entry.listing))
      for (const listener of this.listeners) listener(providerId);
  }
}
