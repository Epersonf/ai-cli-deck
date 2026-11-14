import type { ChatUsage, UsageHistory } from '@deck/shared';
import type { UsageReading } from '../domain/agent.js';
import type { UsageHistoryStore } from './UsageHistoryStore.js';
import type { LimitBook } from './LimitBook.js';

type Cache = NonNullable<ChatUsage['cache']>;

/** What one chat has used: its own cost, context and cache, and the account's limits it shares with others. */
export class UsageMeter {
  private before = 0;
  private run: number | null = null;
  private context: number | null = null;
  private window: number | null = null;
  private cache: Cache | null = null;
  private history: UsageHistory | null;

  constructor(
    private readonly limits: LimitBook,
    /** The account: sessions of one profile share its limits. */
    private readonly account: string,
    private readonly now: () => Date = () => new Date(),
    private readonly telemetry?: { store: UsageHistoryStore; sessionId: string },
  ) {
    this.history = telemetry?.store.read(telemetry.sessionId) ?? null;
  }

  /** Takes in what the agent reported; true when the chat's own figures changed. */
  reading(reading: UsageReading): boolean {
    const before = this.own();
    // Invalidate old measurements after compaction; the provider still manages its own cache.
    if (reading.compacted) {
      this.context = null;
      this.cache = null;
    }
    if (reading.turn && !this.history?.recent.some((turn) => turn.id === reading.turn?.id)) {
      const turn = reading.turn;
      const previous = this.history;
      this.history = {
        turns: (previous?.turns ?? 0) + 1,
        input: (previous?.input ?? 0) + turn.input,
        cached: (previous?.cached ?? 0) + turn.cached,
        output: (previous?.output ?? 0) + turn.output,
        durationMs: (previous?.durationMs ?? 0) + turn.durationMs,
        recent: [...(previous?.recent ?? []), turn].slice(-20),
      };
      this.saveHistory();
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
    return JSON.stringify([this.run, this.context, this.window, this.cache, this.history]);
  }

  private saveHistory(): void {
    try {
      this.telemetry?.store.write(this.telemetry.sessionId, this.history);
    } catch (error) {
      console.error('Could not save chat usage metrics', error);
    }
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
    this.window = null;
    this.history = null;
    this.saveHistory();
  }

  current(): ChatUsage {
    const cost = this.before + (this.run ?? 0);
    return {
      costUsd: cost > 0 ? cost : null,
      contextTokens: this.context,
      contextWindow: this.window,
      limits: this.limits.get(this.account),
      cache: this.cache,
      ...(this.history ? { history: this.history } : {}),
    };
  }
}
