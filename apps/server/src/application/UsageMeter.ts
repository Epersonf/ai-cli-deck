import type { ChatUsage } from '@deck/shared';
import type { UsageReading } from '../domain/agent.js';
import type { LimitBook } from './LimitBook.js';

type Cache = NonNullable<ChatUsage['cache']>;

/** What one chat has used: its own cost, context and cache, and the account's limits it shares with others. */
export class UsageMeter {
  private before = 0;
  private run: number | null = null;
  private context: number | null = null;
  private window: number | null = null;
  private cache: Cache | null = null;

  constructor(
    private readonly limits: LimitBook,
    /** The account: sessions of one profile share its limits. */
    private readonly account: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Takes in what the agent reported; true when the chat's own figures changed. */
  reading(reading: UsageReading): boolean {
    const before = this.own();
    // A compaction empties the context and the cache: they are measured again by the next answer.
    if (reading.compacted) {
      this.context = null;
      this.cache = null;
    }
    if (reading.costUsd !== undefined) this.run = reading.costUsd;
    if (reading.contextTokens !== undefined) this.context = reading.contextTokens;
    if (reading.contextWindow !== undefined) this.window = reading.contextWindow;
    if (reading.cache) {
      // A read does not say how long the cache lives: keep what the last write said.
      const ttlMs = reading.cache.ttlMs ?? this.cache?.ttlMs ?? null;
      this.cache = { ...reading.cache, ttlMs, at: this.now().toISOString() };
    }
    if (reading.limit) this.limits.set(this.account, reading.limit);
    return before !== this.own();
  }

  private own(): string {
    return JSON.stringify([this.run, this.context, this.window, this.cache]);
  }

  /** The agent run ended: the next one counts its cost from zero again. */
  runEnded(): void {
    this.before += this.run ?? 0;
    this.run = null;
  }

  /** A new conversation: nothing used yet. */
  reset(): void {
    this.before = 0;
    this.run = null;
    this.context = null;
    this.cache = null;
  }

  current(): ChatUsage {
    const cost = this.before + (this.run ?? 0);
    return {
      costUsd: cost > 0 ? cost : null,
      contextTokens: this.context,
      contextWindow: this.window,
      limits: this.limits.get(this.account),
      cache: this.cache,
    };
  }
}
